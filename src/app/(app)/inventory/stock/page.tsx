import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, Boxes, Scale } from 'lucide-react'
import { StockBadge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { ListFilters } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDateTime, formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Stock management' }
export const dynamic = 'force-dynamic'

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requirePermission('inventory.view')
  const params = await searchParams

  const [warehouses, products, movements] = await Promise.all([
    db.warehouse.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    }),
    db.product.findMany({
      where: {
        isActive: true,
        ...(params.q
          ? { OR: [{ name: { contains: params.q } }, { sku: { contains: params.q } }] }
          : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        costPrice: true,
        sellingPrice: true,
        reorderLevel: true,
        stockLevels: {
          select: { warehouseId: true, quantity: true },
          ...(params.warehouseId ? { where: { warehouseId: params.warehouseId } } : {}),
        },
      },
    }),
    db.stockMovement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true,
        type: true,
        quantity: true,
        balanceAfter: true,
        reference: true,
        createdAt: true,
        product: { select: { sku: true, name: true } },
        warehouse: { select: { code: true } },
        user: { select: { fullName: true } },
      },
    }),
  ])

  const rows = products
    .map((product) => {
      const byWarehouse = new Map(
        product.stockLevels.map((level) => [level.warehouseId, toNumber(level.quantity)]),
      )
      const quantity = [...byWarehouse.values()].reduce((sum, q) => sum + q, 0)
      const cost = toNumber(product.costPrice)
      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        cost,
        quantity,
        value: quantity * cost,
        reorderLevel: toNumber(product.reorderLevel),
        byWarehouse,
      }
    })
    .filter((row) => {
      if (params.stock === 'out') return row.quantity <= 0
      if (params.stock === 'low') return row.quantity > 0 && row.quantity <= row.reorderLevel
      if (params.stock === 'in') return row.quantity > row.reorderLevel
      return true
    })

  const totalValue = rows.reduce((sum, row) => sum + row.value, 0)
  const totalUnits = rows.reduce((sum, row) => sum + row.quantity, 0)
  const lowCount = rows.filter(
    (row) => row.quantity > 0 && row.quantity <= row.reorderLevel,
  ).length
  const outCount = rows.filter((row) => row.quantity <= 0).length

  const visibleWarehouses = params.warehouseId
    ? warehouses.filter((w) => w.id === params.warehouseId)
    : warehouses

  return (
    <>
      <PageHeader
        breadcrumb="Warehousing & Inventory"
        title="Stock management"
        description="Live quantities by warehouse, with value at weighted average cost."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Stock value"
          value={formatKes(totalValue)}
          sublabel="at weighted average cost"
          tone="green"
          icon={<Scale className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Units on hand"
          value={formatNumber(totalUnits)}
          sublabel={`across ${visibleWarehouses.length} warehouse${visibleWarehouses.length === 1 ? '' : 's'}`}
          tone="dark"
          icon={<Boxes className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Low stock"
          value={formatNumber(lowCount)}
          sublabel="at or below reorder level"
          tone="amber"
          icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Out of stock"
          value={formatNumber(outCount)}
          sublabel="nothing left to sell"
          tone="red"
        />
      </div>

      <ListFilters
        searchPlaceholder="Search by product name or SKU…"
        selects={[
          {
            name: 'warehouseId',
            label: 'Warehouse',
            options: warehouses.map((w) => ({ value: w.id, label: w.name })),
          },
          {
            name: 'stock',
            label: 'Availability',
            options: [
              { value: 'in', label: 'In stock' },
              { value: 'low', label: 'Low stock' },
              { value: 'out', label: 'Out of stock' },
            ],
          },
        ]}
      />

      <Table>
        <THead>
          <TR>
            <TH>SKU</TH>
            <TH>Product</TH>
            {visibleWarehouses.map((warehouse) => (
              <TH key={warehouse.id} align="right">
                {warehouse.code}
              </TH>
            ))}
            <TH align="right">Total</TH>
            <TH align="right">Value</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow
              colSpan={5 + visibleWarehouses.length}
              message="No stock matches these filters."
            />
          ) : (
            rows.map((row) => (
              <TR key={row.id}>
                <TD>
                  <span className="tabular text-saipei-gray-600">{row.sku}</span>
                </TD>
                <TD>
                  <Link
                    href={`/inventory/products/${row.id}`}
                    className="font-semibold text-saipei-dark-700 hover:text-saipei-green-700 hover:underline"
                  >
                    {row.name}
                  </Link>
                  <span className="block text-xs text-saipei-gray-400">
                    {humanize(row.unit)}
                  </span>
                </TD>
                {visibleWarehouses.map((warehouse) => (
                  <TD key={warehouse.id} align="right" numeric>
                    {formatNumber(row.byWarehouse.get(warehouse.id) ?? 0)}
                  </TD>
                ))}
                <TD align="right" numeric>
                  {formatNumber(row.quantity)}
                </TD>
                <TD align="right" numeric>
                  {formatKes(row.value)}
                </TD>
                <TD>
                  <StockBadge quantity={row.quantity} reorderLevel={row.reorderLevel} />
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <p className="mt-3 text-xs text-saipei-gray-500">
        {rows.length} {rows.length === 1 ? 'product' : 'products'}
      </p>

      <div className="mt-6">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Latest stock movements"
              description="Every change to stock, whatever caused it."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Product</TH>
                  <TH>Type</TH>
                  <TH>Reference</TH>
                  <TH>Store</TH>
                  <TH>By</TH>
                  <TH align="right">Change</TH>
                  <TH align="right">Balance</TH>
                </TR>
              </THead>
              <TBody>
                {movements.length === 0 ? (
                  <EmptyRow colSpan={8} message="No stock movements recorded yet." />
                ) : (
                  movements.map((movement) => {
                    const change = toNumber(movement.quantity)
                    return (
                      <TR key={movement.id}>
                        <TD>{formatDateTime(movement.createdAt)}</TD>
                        <TD>
                          <span className="font-medium text-saipei-dark-800">
                            {movement.product.name}
                          </span>
                          <span className="tabular block text-xs text-saipei-gray-500">
                            {movement.product.sku}
                          </span>
                        </TD>
                        <TD>{humanize(movement.type)}</TD>
                        <TD>
                          <span className="tabular text-saipei-gray-600">
                            {movement.reference ?? '—'}
                          </span>
                        </TD>
                        <TD>
                          <span className="tabular">{movement.warehouse.code}</span>
                        </TD>
                        <TD>{movement.user?.fullName ?? '—'}</TD>
                        <TD align="right" numeric>
                          <span
                            className={
                              change >= 0 ? 'text-saipei-green-700' : 'text-saipei-red-600'
                            }
                          >
                            {change >= 0 ? '+' : ''}
                            {formatNumber(change)}
                          </span>
                        </TD>
                        <TD align="right" numeric>
                          {formatNumber(movement.balanceAfter)}
                        </TD>
                      </TR>
                    )
                  })
                )}
              </TBody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}
