import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, Boxes, Container, Scale } from 'lucide-react'
import { StockBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDateTime, formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Stock overview' }
export const dynamic = 'force-dynamic'

export default async function StockOverviewPage() {
  await requirePermission('dashboard.view')

  const [products, warehouses, bales, movements] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        sku: true,
        name: true,
        costPrice: true,
        reorderLevel: true,
        category: { select: { name: true } },
        stockLevels: { select: { warehouseId: true, quantity: true } },
      },
    }),
    db.warehouse.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    }),
    db.bale.aggregate({
      _count: true,
      _sum: { landedCost: true, weightKg: true, piecesEstimate: true },
    }),
    db.stockMovement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        type: true,
        quantity: true,
        balanceAfter: true,
        createdAt: true,
        reference: true,
        product: { select: { sku: true, name: true } },
        warehouse: { select: { code: true } },
      },
    }),
  ])

  const rows = products.map((product) => {
    const quantity = product.stockLevels.reduce(
      (sum, level) => sum + toNumber(level.quantity),
      0,
    )
    const cost = toNumber(product.costPrice)
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      categoryName: product.category?.name ?? 'Uncategorised',
      quantity,
      value: quantity * cost,
      reorderLevel: toNumber(product.reorderLevel),
      byWarehouse: new Map(
        product.stockLevels.map((level) => [level.warehouseId, toNumber(level.quantity)]),
      ),
    }
  })

  const totalValue = rows.reduce((sum, row) => sum + row.value, 0)
  const totalUnits = rows.reduce((sum, row) => sum + row.quantity, 0)
  const needsAttention = rows
    .filter((row) => row.quantity <= row.reorderLevel)
    .sort((a, b) => a.quantity - b.quantity)

  // Value held in each warehouse, so the split is visible at a glance.
  const warehouseTotals = warehouses.map((warehouse) => {
    const units = rows.reduce(
      (sum, row) => sum + (row.byWarehouse.get(warehouse.id) ?? 0),
      0,
    )
    return { ...warehouse, units }
  })

  return (
    <>
      <PageHeader
        breadcrumb="Dashboard"
        title="Stock overview"
        description="What is on the shelves right now, and what needs attention."
        action={
          <Link href="/inventory/stock">
            <Button variant="secondary">Manage stock</Button>
          </Link>
        }
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
          sublabel={`${formatNumber(rows.length)} active products`}
          tone="dark"
          icon={<Boxes className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Bales received"
          value={formatNumber(bales._count)}
          sublabel={`${formatNumber(toNumber(bales._sum.weightKg), 0)} kg landed`}
          tone="dark"
          icon={<Container className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Needing reorder"
          value={formatNumber(needsAttention.length)}
          sublabel="at or below reorder level"
          tone={needsAttention.length > 0 ? 'amber' : 'green'}
          icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {warehouseTotals.map((warehouse) => (
          <StatCard
            key={warehouse.id}
            label={warehouse.name}
            value={formatNumber(warehouse.units)}
            sublabel="units held here"
            tone="dark"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Needs reordering"
              description="Lowest stock first."
              action={
                <Link href="/inventory/products">
                  <Button variant="ghost" size="sm">
                    Products
                  </Button>
                </Link>
              }
            />
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH>Category</TH>
                  <TH align="right">On hand</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {needsAttention.length === 0 ? (
                  <EmptyRow
                    colSpan={4}
                    message="Everything is above its reorder level."
                  />
                ) : (
                  needsAttention.map((row) => (
                    <TR key={row.id}>
                      <TD>
                        <Link
                          href={`/inventory/products/${row.id}`}
                          className="font-medium text-saipei-dark-700 hover:underline"
                        >
                          {row.name}
                        </Link>
                        <span className="tabular block text-xs text-saipei-gray-500">
                          {row.sku}
                        </span>
                      </TD>
                      <TD>{row.categoryName}</TD>
                      <TD align="right" numeric>
                        {formatNumber(row.quantity)}
                      </TD>
                      <TD>
                        <StockBadge
                          quantity={row.quantity}
                          reorderLevel={row.reorderLevel}
                        />
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </table>
          </div>
        </Card>

        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Latest movements"
              description="The last ten changes to stock."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Product</TH>
                  <TH>Type</TH>
                  <TH>Store</TH>
                  <TH align="right">Change</TH>
                </TR>
              </THead>
              <TBody>
                {movements.length === 0 ? (
                  <EmptyRow colSpan={5} message="No stock movements recorded yet." />
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
                            {movement.reference ?? movement.product.sku}
                          </span>
                        </TD>
                        <TD>{humanize(movement.type)}</TD>
                        <TD>
                          <span className="tabular">{movement.warehouse.code}</span>
                        </TD>
                        <TD align="right" numeric>
                          <span
                            className={
                              change >= 0
                                ? 'text-saipei-green-700'
                                : 'text-saipei-red-600'
                            }
                          >
                            {change >= 0 ? '+' : ''}
                            {formatNumber(change)}
                          </span>
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
