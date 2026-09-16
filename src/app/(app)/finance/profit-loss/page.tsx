import type { Metadata } from 'next'
import { PiggyBank, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { ListFilters } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { PrintButton } from '@/components/ui/print-button'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { getProfitAndLoss, resolveRange } from '@/lib/queries/reports'
import { formatDate, formatKes, formatNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Profit & loss' }
export const dynamic = 'force-dynamic'

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requirePermission('reports.profit')
  const params = await searchParams
  const range = resolveRange(params)
  const pl = await getProfitAndLoss(range)

  return (
    <>
      <PageHeader
        breadcrumb="Finance & Expenses"
        title="Profit & loss"
        description={`Trading result for ${formatDate(range.from)} to ${formatDate(range.to)}.`}
        action={<PrintButton label="Print statement" />}
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
          label="Cost of sales"
          value={formatKes(pl.costOfSales)}
          sublabel="landed cost of what was sold"
          tone="red"
          icon={<TrendingDown className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Gross profit"
          value={formatKes(pl.grossProfit)}
          sublabel={`${pl.grossMargin.toFixed(1)}% gross margin`}
          tone="green"
        />
        <StatCard
          label="Net profit"
          value={formatKes(pl.netProfit)}
          sublabel={`${pl.netMargin.toFixed(1)}% net margin`}
          tone={pl.netProfit >= 0 ? 'green' : 'red'}
          icon={<PiggyBank className="h-4 w-4" aria-hidden />}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Statement"
              description={`${formatDate(range.from)} — ${formatDate(range.to)}`}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <TBody>
                <StatementRow label="Gross sales" value={pl.revenue + pl.salesReturns} />
                {pl.salesReturns > 0 ? (
                  <StatementRow label="Less: sales returns" value={-pl.salesReturns} />
                ) : null}
                <StatementRow label="Net revenue" value={pl.revenue} subtotal />
                <StatementRow label="Less: cost of sales" value={-pl.costOfSales} />
                <StatementRow label="Gross profit" value={pl.grossProfit} subtotal />

                <TR>
                  <TD colSpan={2}>
                    <span className="text-xs font-semibold tracking-wider text-saipei-dark-700 uppercase">
                      Operating expenses
                    </span>
                  </TD>
                </TR>
                {pl.expensesByCategory.length === 0 ? (
                  <TR>
                    <TD className="pl-8 text-saipei-gray-500">No expenses in this period</TD>
                    <TD align="right" numeric>
                      {formatKes(0)}
                    </TD>
                  </TR>
                ) : (
                  pl.expensesByCategory.map((row) => (
                    <TR key={row.name}>
                      <TD className="pl-8 text-saipei-gray-600">{row.name}</TD>
                      <TD align="right" numeric>
                        <span className="text-saipei-red-600">
                          −{formatKes(row.amount)}
                        </span>
                      </TD>
                    </TR>
                  ))
                )}
                <StatementRow label="Total operating expenses" value={-pl.totalExpenses} subtotal />

                <TR className="border-t-2 border-saipei-dark-700 bg-saipei-gray-50">
                  <TD>
                    <span className="text-base font-bold text-saipei-dark-800">
                      Net profit
                    </span>
                  </TD>
                  <TD align="right" numeric>
                    <span
                      className={
                        'text-lg font-bold ' +
                        (pl.netProfit >= 0
                          ? 'text-saipei-green-700'
                          : 'text-saipei-red-600')
                      }
                    >
                      {formatKes(pl.netProfit)}
                    </span>
                  </TD>
                </TR>
              </TBody>
            </table>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Margins"
              description="How much of each shilling of revenue is kept."
            />
            <div className="space-y-4">
              <MarginBar label="Gross margin" percent={pl.grossMargin} tone="green" />
              <MarginBar
                label="Net margin"
                percent={pl.netMargin}
                tone={pl.netMargin >= 0 ? 'green' : 'red'}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Import charges in the period"
              description="Already carried in the landed cost of stock, shown here for context."
            />
            <p className="tabular text-2xl font-bold text-saipei-dark-800">
              {formatKes(pl.importCharges)}
            </p>
            <p className="mt-1 text-xs text-saipei-gray-500">
              Freight, duty, clearing and transport captured against import orders in this
              period. These are not deducted again below gross profit — they reach the
              statement through cost of sales as the goods are sold.
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}

function StatementRow({
  label,
  value,
  subtotal,
}: {
  label: string
  value: number
  subtotal?: boolean
}) {
  return (
    <TR className={subtotal ? 'bg-saipei-gray-50' : undefined}>
      <TD>
        <span
          className={
            subtotal
              ? 'font-semibold text-saipei-dark-800'
              : 'text-saipei-gray-700'
          }
        >
          {label}
        </span>
      </TD>
      <TD align="right" numeric>
        <span
          className={
            subtotal
              ? 'font-bold text-saipei-dark-800'
              : value < 0
                ? 'text-saipei-red-600'
                : 'text-saipei-gray-900'
          }
        >
          {value < 0 && !subtotal ? `−${formatKes(Math.abs(value))}` : formatKes(value)}
        </span>
      </TD>
    </TR>
  )
}

function MarginBar({
  label,
  percent,
  tone,
}: {
  label: string
  percent: number
  tone: 'green' | 'red'
}) {
  const width = Math.min(100, Math.max(0, Math.abs(percent)))
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-saipei-gray-600">{label}</span>
        <span
          className={
            'tabular text-lg font-bold ' +
            (tone === 'green' ? 'text-saipei-green-700' : 'text-saipei-red-600')
          }
        >
          {percent.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-saipei-gray-200">
        <div
          className={
            'h-full rounded-full ' +
            (tone === 'green' ? 'bg-saipei-green-500' : 'bg-saipei-red-500')
          }
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}
