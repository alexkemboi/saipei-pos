import type { Metadata } from 'next'
import { Boxes, Scale, TrendingUp } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { ListFilters } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { PrintButton } from '@/components/ui/print-button'
import { EmptyRow, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatKes, formatNumber, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Inventory valuation' }
export const dynamic = 'force-dynamic'

export default async function ValuationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requirePermission('inventory.view')
  const params = await searchParams

  const [warehouses, categories, products] = await Promise.all([
    db.warehouse.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    db.category.findMany({ orderBy: { name: 'asc' } }),
    db.product.findMany({
      where: {
        isActive: true,
        ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        sku: true,
        name: true,
        costPrice: true,
        sellingPrice: true,
        category: { select: { name: true } },
        stockLevels: {
          select: { quantity: true },
          ...(params.warehouseId ? { where: { warehouseId: params.warehouseId } } : {}),
        },
      },
    }),
  ])

  const rows = products
    .map((product) => {
      const quantity = product.stockLevels.reduce(
        (sum, level) => sum + toNumber(level.quantity),
        0,
      )
      const cost = toNumber(product.costPrice)
      const price = toNumber(product.sellingPrice)
      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        categoryName: product.category?.name ?? 'Uncategorised',
        quantity,
        cost,
        price,
        costValue: quantity * cost,
        retailValue: quantity * price,
      }
    })
    .filter((row) => row.quantity !== 0)

  const totalCost = rows.reduce((sum, row) => sum + row.costValue, 0)
  const totalRetail = rows.reduce((sum, row) => sum + row.retailValue, 0)
  const potentialProfit = totalRetail - totalCost

  // Group by category for the summary table.
  const byCategory = new Map<string, { cost: number; retail: number; units: number }>()
  for (const row of rows) {
    const current = byCategory.get(row.categoryName) ?? { cost: 0, retail: 0, units: 0 }
    byCategory.set(row.categoryName, {
      cost: current.cost + row.costValue,
      retail: current.retail + row.retailValue,
      units: current.units + row.quantity,
    })
  }

  const warehouseName = params.warehouseId
    ? (warehouses.find((w) => w.id === params.warehouseId)?.name ?? 'All warehouses')
    : 'All warehouses'

  return (
    <>
      <PageHeader
        breadcrumb="Warehousing & Inventory"
        title="Inventory valuation"
        description={`Stock on hand valued at weighted average cost — ${warehouseName}.`}
        action={<PrintButton label="Print valuation" />}
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Value at cost"
          value={formatKes(totalCost)}
          sublabel="what the stock cost to land"
          tone="dark"
          icon={<Scale className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Value at retail"
          value={formatKes(totalRetail)}
          sublabel="if every unit sells at list price"
          tone="green"
          icon={<TrendingUp className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Potential gross profit"
          value={formatKes(potentialProfit)}
          sublabel={
            totalRetail > 0
              ? `${((potentialProfit / totalRetail) * 100).toFixed(1)}% margin`
              : 'no stock on hand'
          }
          tone="green"
        />
        <StatCard
          label="Units on hand"
          value={formatNumber(rows.reduce((sum, row) => sum + row.quantity, 0))}
          sublabel={`${rows.length} products with stock`}
          tone="dark"
          icon={<Boxes className="h-4 w-4" aria-hidden />}
        />
      </div>

      <div className="no-print">
        <ListFilters
          showSearch={false}
          selects={[
            {
              name: 'warehouseId',
              label: 'Warehouse',
              options: warehouses.map((w) => ({ value: w.id, label: w.name })),
            },
            {
              name: 'categoryId',
              label: 'Category',
              options: categories.map((c) => ({ value: c.id, label: c.name })),
            },
          ]}
        />
      </div>

      <div className="mb-5">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="By category" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Category</TH>
                  <TH align="right">Units</TH>
                  <TH align="right">Value at cost</TH>
                  <TH align="right">Value at retail</TH>
                  <TH align="right">Potential profit</TH>
                </TR>
              </THead>
              <TBody>
                {byCategory.size === 0 ? (
                  <EmptyRow colSpan={5} message="No stock on hand." />
                ) : (
                  [...byCategory.entries()]
                    .sort((a, b) => b[1].cost - a[1].cost)
                    .map(([name, totals]) => (
                      <TR key={name}>
                        <TD>
                          <span className="font-medium text-saipei-dark-800">{name}</span>
                        </TD>
                        <TD align="right" numeric>
                          {formatNumber(totals.units)}
                        </TD>
                        <TD align="right" numeric>
                          {formatKes(totals.cost)}
                        </TD>
                        <TD align="right" numeric>
                          {formatKes(totals.retail)}
                        </TD>
                        <TD align="right" numeric>
                          <span className="text-saipei-green-700">
                            {formatKes(totals.retail - totals.cost)}
                          </span>
                        </TD>
                      </TR>
                    ))
                )}
              </TBody>
            </table>
          </div>
        </Card>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>SKU</TH>
            <TH>Product</TH>
            <TH>Category</TH>
            <TH align="right">Qty</TH>
            <TH align="right">Unit cost</TH>
            <TH align="right">Value at cost</TH>
            <TH align="right">Unit price</TH>
            <TH align="right">Value at retail</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={8} message="No stock on hand for these filters." />
          ) : (
            <>
              {rows.map((row) => (
                <TR key={row.id}>
                  <TD>
                    <span className="tabular text-saipei-gray-600">{row.sku}</span>
                  </TD>
                  <TD>
                    <span className="font-medium text-saipei-dark-800">{row.name}</span>
                  </TD>
                  <TD>{row.categoryName}</TD>
                  <TD align="right" numeric>
                    {formatNumber(row.quantity)}
                  </TD>
                  <TD align="right" numeric>
                    {formatKes(row.cost)}
                  </TD>
                  <TD align="right" numeric>
                    {formatKes(row.costValue)}
                  </TD>
                  <TD align="right" numeric>
                    {formatKes(row.price)}
                  </TD>
                  <TD align="right" numeric>
                    {formatKes(row.retailValue)}
                  </TD>
                </TR>
              ))}
              <TR className="border-t-2 border-saipei-dark-700 bg-saipei-gray-50">
                <TD colSpan={5}>
                  <span className="font-bold text-saipei-dark-800">Total</span>
                </TD>
                <TD align="right" numeric>
                  <span className="font-bold text-saipei-dark-800">
                    {formatKes(totalCost)}
                  </span>
                </TD>
                <TD />
                <TD align="right" numeric>
                  <span className="font-bold text-saipei-dark-800">
                    {formatKes(totalRetail)}
                  </span>
                </TD>
              </TR>
            </>
          )}
        </TBody>
      </Table>
    </>
  )
}
