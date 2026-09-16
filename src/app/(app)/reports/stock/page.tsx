import type { Metadata } from 'next'
import { AlertTriangle, Boxes, Repeat, Scale } from 'lucide-react'
import { StockBadge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { ListFilters } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { PrintButton } from '@/components/ui/print-button'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { resolveRange } from '@/lib/queries/reports'
import { formatDate, formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Stock reports' }
export const dynamic = 'force-dynamic'

export default async function StockReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requirePermission('reports.view')
  const params = await searchParams
  const range = resolveRange(params)

  const [products, movementsByType, slowMovers] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        sku: true,
        name: true,
        costPrice: true,
        sellingPrice: true,
        reorderLevel: true,
        category: { select: { name: true } },
        stockLevels: { select: { quantity: true } },
      },
    }),
    db.stockMovement.groupBy({
      by: ['type'],
      where: { createdAt: { gte: range.from, lte: range.to } },
      _sum: { quantity: true },
      _count: { _all: true },
    }),
    db.saleLine.groupBy({
      by: ['productId'],
      where: {
        sale: {
          saleDate: { gte: range.from, lte: range.to },
          status: { not: 'VOIDED' },
        },
      },
      _sum: { quantity: true },
    }),
  ])

  const soldByProduct = new Map(
    slowMovers.map((row) => [row.productId, toNumber(row._sum.quantity)]),
  )

  const rows = products.map((product) => {
    const quantity = product.stockLevels.reduce(
      (sum, level) => sum + toNumber(level.quantity),
      0,
    )
    const cost = toNumber(product.costPrice)
    const sold = soldByProduct.get(product.id) ?? 0
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      categoryName: product.category?.name ?? 'Uncategorised',
      quantity,
      cost,
      value: quantity * cost,
      reorderLevel: toNumber(product.reorderLevel),
      sold,
      // How many times the stock on hand turned over in the period.
      turnover: quantity > 0 ? sold / quantity : sold > 0 ? Infinity : 0,
    }
  })

  const totalValue = rows.reduce((sum, row) => sum + row.value, 0)
  const lowStock = rows.filter((r) => r.quantity > 0 && r.quantity <= r.reorderLevel)
  const outOfStock = rows.filter((r) => r.quantity <= 0)
  const dead = rows
    .filter((r) => r.quantity > 0 && r.sold === 0)
    .sort((a, b) => b.value - a.value)

  return (
    <>
      <PageHeader
        breadcrumb="Reports & Analytics"
        title="Stock report"
        description={`Stock position now, with movement from ${formatDate(range.from)} to ${formatDate(range.to)}.`}
        action={<PrintButton label="Print report" />}
      />

      <div className="no-print">
        <ListFilters showSearch={false} showDateRange />
      </div>

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
          value={formatNumber(rows.reduce((sum, r) => sum + r.quantity, 0))}
          sublabel={`${formatNumber(rows.length)} active products`}
          tone="dark"
          icon={<Boxes className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Low stock"
          value={formatNumber(lowStock.length)}
          sublabel="at or below reorder level"
          tone="amber"
          icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Not sold in period"
          value={formatNumber(dead.length)}
          sublabel={`${formatKes(dead.reduce((s, r) => s + r.value, 0))} tied up`}
          tone={dead.length > 0 ? 'red' : 'green'}
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Movement in the period"
              description="Every reason stock went in or out."
              action={<Repeat className="h-4 w-4 text-saipei-gray-400" aria-hidden />}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Type</TH>
                  <TH align="right">Movements</TH>
                  <TH align="right">Net units</TH>
                </TR>
              </THead>
              <TBody>
                {movementsByType.length === 0 ? (
                  <EmptyRow colSpan={3} message="No stock movements in this period." />
                ) : (
                  movementsByType
                    .map((row) => ({
                      type: row.type,
                      count: row._count._all,
                      net: toNumber(row._sum.quantity),
                    }))
                    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
                    .map((row) => (
                      <TR key={row.type}>
                        <TD>
                          <span className="font-medium text-saipei-dark-800">
                            {humanize(row.type)}
                          </span>
                        </TD>
                        <TD align="right" numeric>
                          {formatNumber(row.count)}
                        </TD>
                        <TD align="right" numeric>
                          <span
                            className={
                              row.net >= 0
                                ? 'text-saipei-green-700'
                                : 'text-saipei-red-600'
                            }
                          >
                            {row.net >= 0 ? '+' : ''}
                            {formatNumber(row.net)}
                          </span>
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
              title="Stock needing attention"
              description="Low or out of stock right now."
            />
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH align="right">On hand</TH>
                  <TH align="right">Reorder at</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {[...outOfStock, ...lowStock].length === 0 ? (
                  <EmptyRow colSpan={4} message="Everything is above its reorder level." />
                ) : (
                  [...outOfStock, ...lowStock].map((row) => (
                    <TR key={row.id}>
                      <TD>
                        <span className="font-medium text-saipei-dark-800">{row.name}</span>
                        <span className="tabular block text-xs text-saipei-gray-500">
                          {row.sku}
                        </span>
                      </TD>
                      <TD align="right" numeric>
                        {formatNumber(row.quantity)}
                      </TD>
                      <TD align="right" numeric>
                        {formatNumber(row.reorderLevel)}
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
      </div>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Slow-moving stock"
            description="Held in the warehouse but not sold in this period — capital tied up."
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <THead>
              <TR>
                <TH>SKU</TH>
                <TH>Product</TH>
                <TH>Category</TH>
                <TH align="right">On hand</TH>
                <TH align="right">Unit cost</TH>
                <TH align="right">Capital tied up</TH>
              </TR>
            </THead>
            <TBody>
              {dead.length === 0 ? (
                <EmptyRow colSpan={6} message="Everything in stock sold at least once." />
              ) : (
                dead.slice(0, 25).map((row) => (
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
                      <span className="text-saipei-red-600">{formatKes(row.value)}</span>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </table>
        </div>
      </Card>
    </>
  )
}
