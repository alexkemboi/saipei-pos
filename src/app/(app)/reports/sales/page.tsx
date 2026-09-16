import type { Metadata } from 'next'
import { BarChart3, Receipt, TrendingUp, Users } from 'lucide-react'
import { BarChart } from '@/components/ui/bar-chart'
import { Card, CardHeader } from '@/components/ui/card'
import { ListFilters } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { PrintButton } from '@/components/ui/print-button'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  getDailySales,
  getProductPerformance,
  resolveRange,
  REVENUE_STATUSES,
} from '@/lib/queries/reports'
import { formatDate, formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Sales reports' }
export const dynamic = 'force-dynamic'

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const user = await requirePermission('reports.view')
  const params = await searchParams
  const range = resolveRange(params)
  const showProfit = user.permissions.includes('reports.profit')

  const [daily, products, byChannel, byCashier, topCustomers] = await Promise.all([
    getDailySales(range),
    getProductPerformance(range, 15),
    db.sale.groupBy({
      by: ['channel'],
      where: {
        saleDate: { gte: range.from, lte: range.to },
        status: { in: REVENUE_STATUSES },
      },
      _sum: { total: true },
      _count: { _all: true },
    }),
    db.sale.groupBy({
      by: ['cashierId'],
      where: {
        saleDate: { gte: range.from, lte: range.to },
        status: { in: REVENUE_STATUSES },
      },
      _sum: { total: true },
      _count: { _all: true },
    }),
    db.sale.groupBy({
      by: ['customerId'],
      where: {
        saleDate: { gte: range.from, lte: range.to },
        status: { in: REVENUE_STATUSES },
        customerId: { not: null },
      },
      _sum: { total: true },
      _count: { _all: true },
    }),
  ])

  const cashiers = await db.user.findMany({
    where: { id: { in: byCashier.map((row) => row.cashierId) } },
    select: { id: true, fullName: true },
  })
  const cashierNames = new Map(cashiers.map((c) => [c.id, c.fullName]))

  const customers = await db.customer.findMany({
    where: {
      id: { in: topCustomers.map((row) => row.customerId).filter(Boolean) as string[] },
    },
    select: { id: true, name: true },
  })
  const customerNames = new Map(customers.map((c) => [c.id, c.name]))

  const revenue = daily.reduce((sum, day) => sum + day.revenue, 0)
  const cost = daily.reduce((sum, day) => sum + day.cost, 0)
  const transactions = daily.reduce((sum, day) => sum + day.transactions, 0)
  const bestDay = [...daily].sort((a, b) => b.revenue - a.revenue)[0]

  return (
    <>
      <PageHeader
        breadcrumb="Reports & Analytics"
        title="Sales report"
        description={`${formatDate(range.from)} to ${formatDate(range.to)}.`}
        action={<PrintButton label="Print report" />}
      />

      <div className="no-print">
        <ListFilters showSearch={false} showDateRange />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatKes(revenue)}
          sublabel={`${formatNumber(transactions)} transactions`}
          tone="green"
          icon={<TrendingUp className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Average sale"
          value={formatKes(transactions > 0 ? revenue / transactions : 0)}
          sublabel="per transaction"
          tone="dark"
          icon={<Receipt className="h-4 w-4" aria-hidden />}
        />
        {showProfit ? (
          <StatCard
            label="Gross profit"
            value={formatKes(revenue - cost)}
            sublabel={
              revenue > 0 ? `${(((revenue - cost) / revenue) * 100).toFixed(1)}% margin` : '—'
            }
            tone="green"
          />
        ) : (
          <StatCard
            label="Trading days"
            value={formatNumber(daily.length)}
            sublabel="days with at least one sale"
            tone="dark"
          />
        )}
        <StatCard
          label="Best day"
          value={bestDay ? formatKes(bestDay.revenue) : '—'}
          sublabel={bestDay ? formatDate(bestDay.date) : 'no sales in this period'}
          tone="dark"
          icon={<BarChart3 className="h-4 w-4" aria-hidden />}
        />
      </div>

      <div className="mb-5">
        <Card>
          <CardHeader
            title="Daily revenue"
            description={showProfit ? 'Revenue against cost of sales.' : 'Revenue per day.'}
          />
          <BarChart
            data={daily.map((day) => ({
              label: day.date.slice(8),
              value: day.revenue,
              ...(showProfit ? { secondary: day.cost } : {}),
            }))}
            valueLabel="Revenue"
            secondaryLabel={showProfit ? 'Cost of sales' : undefined}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Best sellers" description="By revenue in this period." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH align="right">Qty sold</TH>
                  <TH align="right">Revenue</TH>
                  {showProfit ? <TH align="right">Margin</TH> : null}
                </TR>
              </THead>
              <TBody>
                {products.length === 0 ? (
                  <EmptyRow
                    colSpan={showProfit ? 4 : 3}
                    message="No sales in this period."
                  />
                ) : (
                  products.map((product) => (
                    <TR key={product.productId}>
                      <TD>
                        <span className="font-medium text-saipei-dark-800">
                          {product.name}
                        </span>
                        <span className="tabular block text-xs text-saipei-gray-500">
                          {product.sku}
                        </span>
                      </TD>
                      <TD align="right" numeric>
                        {formatNumber(product.quantity)}
                      </TD>
                      <TD align="right" numeric>
                        {formatKes(product.revenue)}
                      </TD>
                      {showProfit ? (
                        <TD align="right" numeric>
                          <span
                            className={
                              product.margin >= 0
                                ? 'text-saipei-green-700'
                                : 'text-saipei-red-600'
                            }
                          >
                            {product.margin.toFixed(1)}%
                          </span>
                        </TD>
                      ) : null}
                    </TR>
                  ))
                )}
              </TBody>
            </table>
          </div>
        </Card>

        <div className="space-y-5">
          <Card padded={false}>
            <div className="px-5 pt-5">
              <CardHeader title="By channel" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <THead>
                  <TR>
                    <TH>Channel</TH>
                    <TH align="right">Transactions</TH>
                    <TH align="right">Revenue</TH>
                  </TR>
                </THead>
                <TBody>
                  {byChannel.length === 0 ? (
                    <EmptyRow colSpan={3} message="No sales in this period." />
                  ) : (
                    byChannel.map((row) => (
                      <TR key={row.channel}>
                        <TD>
                          <span className="font-medium text-saipei-dark-800">
                            {humanize(row.channel)}
                          </span>
                        </TD>
                        <TD align="right" numeric>
                          {formatNumber(row._count._all)}
                        </TD>
                        <TD align="right" numeric>
                          {formatKes(toNumber(row._sum.total))}
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
              <CardHeader title="By cashier" description="Who rang up what." />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <THead>
                  <TR>
                    <TH>Cashier</TH>
                    <TH align="right">Transactions</TH>
                    <TH align="right">Revenue</TH>
                  </TR>
                </THead>
                <TBody>
                  {byCashier.length === 0 ? (
                    <EmptyRow colSpan={3} message="No sales in this period." />
                  ) : (
                    byCashier
                      .map((row) => ({
                        name: cashierNames.get(row.cashierId) ?? 'Unknown',
                        count: row._count._all,
                        total: toNumber(row._sum.total),
                      }))
                      .sort((a, b) => b.total - a.total)
                      .map((row) => (
                        <TR key={row.name}>
                          <TD>
                            <span className="font-medium text-saipei-dark-800">
                              {row.name}
                            </span>
                          </TD>
                          <TD align="right" numeric>
                            {formatNumber(row.count)}
                          </TD>
                          <TD align="right" numeric>
                            {formatKes(row.total)}
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
                title="Top customers"
                description="Named accounts only — walk-in trade is excluded."
                action={<Users className="h-4 w-4 text-saipei-gray-400" aria-hidden />}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <THead>
                  <TR>
                    <TH>Customer</TH>
                    <TH align="right">Transactions</TH>
                    <TH align="right">Revenue</TH>
                  </TR>
                </THead>
                <TBody>
                  {topCustomers.length === 0 ? (
                    <EmptyRow colSpan={3} message="No named-account sales in this period." />
                  ) : (
                    topCustomers
                      .map((row) => ({
                        name: customerNames.get(row.customerId ?? '') ?? 'Unknown',
                        count: row._count._all,
                        total: toNumber(row._sum.total),
                      }))
                      .sort((a, b) => b.total - a.total)
                      .slice(0, 10)
                      .map((row) => (
                        <TR key={row.name}>
                          <TD>
                            <span className="font-medium text-saipei-dark-800">
                              {row.name}
                            </span>
                          </TD>
                          <TD align="right" numeric>
                            {formatNumber(row.count)}
                          </TD>
                          <TD align="right" numeric>
                            {formatKes(row.total)}
                          </TD>
                        </TR>
                      ))
                  )}
                </TBody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
