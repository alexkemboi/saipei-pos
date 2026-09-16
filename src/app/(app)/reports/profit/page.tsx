import type { Metadata } from 'next'
import { PiggyBank, TrendingDown, TrendingUp } from 'lucide-react'
import { BarChart } from '@/components/ui/bar-chart'
import { Card, CardHeader } from '@/components/ui/card'
import { ListFilters } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { PrintButton } from '@/components/ui/print-button'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import {
  getDailySales,
  getProductPerformance,
  getProfitAndLoss,
  resolveRange,
} from '@/lib/queries/reports'
import { formatDate, formatKes, formatNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Profit reports' }
export const dynamic = 'force-dynamic'

export default async function ProfitReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requirePermission('reports.profit')
  const params = await searchParams
  const range = resolveRange(params)

  const [pl, daily, products] = await Promise.all([
    getProfitAndLoss(range),
    getDailySales(range),
    getProductPerformance(range, 100),
  ])

  const mostProfitable = [...products].sort((a, b) => b.profit - a.profit).slice(0, 10)
  const leastProfitable = [...products]
    .filter((p) => p.revenue > 0)
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 10)

  return (
    <>
      <PageHeader
        breadcrumb="Reports & Analytics"
        title="Profit report"
        description={`Where the money is made, ${formatDate(range.from)} to ${formatDate(range.to)}.`}
        action={<PrintButton label="Print report" />}
      />

      <div className="no-print">
        <ListFilters showSearch={false} showDateRange />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Net revenue"
          value={formatKes(pl.revenue)}
          sublabel={`${formatNumber(pl.transactionCount)} transactions`}
          tone="green"
          icon={<TrendingUp className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Gross profit"
          value={formatKes(pl.grossProfit)}
          sublabel={`${pl.grossMargin.toFixed(1)}% gross margin`}
          tone="green"
          icon={<PiggyBank className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Operating expenses"
          value={formatKes(pl.totalExpenses)}
          sublabel={`${formatNumber(pl.expensesByCategory.length)} categories`}
          tone="red"
          icon={<TrendingDown className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Net profit"
          value={formatKes(pl.netProfit)}
          sublabel={`${pl.netMargin.toFixed(1)}% net margin`}
          tone={pl.netProfit >= 0 ? 'green' : 'red'}
        />
      </div>

      <div className="mb-5">
        <Card>
          <CardHeader
            title="Daily gross profit"
            description="Revenue against the cost of the goods sold that day."
          />
          <BarChart
            data={daily.map((day) => ({
              label: day.date.slice(8),
              value: day.profit,
              secondary: day.revenue,
            }))}
            valueLabel="Gross profit"
            secondaryLabel="Revenue"
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Most profitable products"
              description="By shillings of gross profit."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH align="right">Sold</TH>
                  <TH align="right">Revenue</TH>
                  <TH align="right">Profit</TH>
                  <TH align="right">Margin</TH>
                </TR>
              </THead>
              <TBody>
                {mostProfitable.length === 0 ? (
                  <EmptyRow colSpan={5} message="No sales in this period." />
                ) : (
                  mostProfitable.map((product) => (
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
                      <TD align="right" numeric>
                        <span className="text-saipei-green-700">
                          {formatKes(product.profit)}
                        </span>
                      </TD>
                      <TD align="right" numeric>
                        {product.margin.toFixed(1)}%
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
              title="Thinnest margins"
              description="Products worth repricing or renegotiating."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH align="right">Sold</TH>
                  <TH align="right">Revenue</TH>
                  <TH align="right">Profit</TH>
                  <TH align="right">Margin</TH>
                </TR>
              </THead>
              <TBody>
                {leastProfitable.length === 0 ? (
                  <EmptyRow colSpan={5} message="No sales in this period." />
                ) : (
                  leastProfitable.map((product) => (
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
                      <TD align="right" numeric>
                        <span
                          className={
                            product.profit >= 0
                              ? 'text-saipei-gray-900'
                              : 'text-saipei-red-600'
                          }
                        >
                          {formatKes(product.profit)}
                        </span>
                      </TD>
                      <TD align="right" numeric>
                        <span
                          className={
                            product.margin < 10
                              ? 'text-saipei-red-600'
                              : product.margin < 25
                                ? 'text-saipei-amber-700'
                                : 'text-saipei-green-700'
                          }
                        >
                          {product.margin.toFixed(1)}%
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
    </>
  )
}
