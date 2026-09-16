import type { Metadata } from 'next'
import { Receipt, TrendingDown, Wallet } from 'lucide-react'
import { BarChart } from '@/components/ui/bar-chart'
import { Card, CardHeader } from '@/components/ui/card'
import { ListFilters } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { PrintButton } from '@/components/ui/print-button'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { resolveRange } from '@/lib/queries/reports'
import { formatDate, formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Expense reports' }
export const dynamic = 'force-dynamic'

export default async function ExpenseReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requirePermission('reports.view')
  const params = await searchParams
  const range = resolveRange(params)

  const [expenses, categories, byMethod] = await Promise.all([
    db.expense.findMany({
      where: {
        expenseDate: { gte: range.from, lte: range.to },
        status: 'APPROVED',
      },
      orderBy: { expenseDate: 'desc' },
      select: {
        id: true,
        reference: true,
        description: true,
        amount: true,
        method: true,
        expenseDate: true,
        payeeName: true,
        categoryId: true,
        category: { select: { name: true } },
      },
    }),
    db.expenseCategory.findMany({ select: { id: true, name: true } }),
    db.expense.groupBy({
      by: ['method'],
      where: {
        expenseDate: { gte: range.from, lte: range.to },
        status: 'APPROVED',
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ])

  const total = expenses.reduce((sum, e) => sum + toNumber(e.amount), 0)

  // Group by category and by month for the two summary views.
  const byCategory = new Map<string, number>()
  const byMonth = new Map<string, number>()
  for (const expense of expenses) {
    const categoryName =
      categories.find((c) => c.id === expense.categoryId)?.name ?? 'Uncategorised'
    byCategory.set(
      categoryName,
      (byCategory.get(categoryName) ?? 0) + toNumber(expense.amount),
    )

    const monthKey = expense.expenseDate.toISOString().slice(0, 7)
    byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + toNumber(expense.amount))
  }

  const categoryRows = [...byCategory.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)

  const monthRows = [...byMonth.entries()]
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month))

  const days = Math.max(
    1,
    Math.ceil((range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)),
  )

  return (
    <>
      <PageHeader
        breadcrumb="Reports & Analytics"
        title="Expense report"
        description={`Operating costs, ${formatDate(range.from)} to ${formatDate(range.to)}.`}
        action={<PrintButton label="Print report" />}
      />

      <div className="no-print">
        <ListFilters showSearch={false} showDateRange />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total expenses"
          value={formatKes(total)}
          sublabel={`${formatNumber(expenses.length)} entries`}
          tone="red"
          icon={<Receipt className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Daily average"
          value={formatKes(total / days)}
          sublabel={`over ${formatNumber(days)} days`}
          tone="red"
          icon={<TrendingDown className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Largest category"
          value={categoryRows[0]?.name ?? '—'}
          sublabel={categoryRows[0] ? formatKes(categoryRows[0].amount) : 'no expenses'}
          tone="amber"
        />
        <StatCard
          label="Categories used"
          value={formatNumber(categoryRows.length)}
          sublabel={`of ${formatNumber(categories.length)} available`}
          tone="dark"
          icon={<Wallet className="h-4 w-4" aria-hidden />}
        />
      </div>

      {monthRows.length > 1 ? (
        <div className="mb-5">
          <Card>
            <CardHeader title="Expenses by month" />
            <BarChart
              data={monthRows.map((row) => ({ label: row.month.slice(5), value: row.amount }))}
              valueLabel="Expenses"
            />
          </Card>
        </div>
      ) : null}

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="By category" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Category</TH>
                  <TH align="right">Total</TH>
                  <TH align="right">Share</TH>
                </TR>
              </THead>
              <TBody>
                {categoryRows.length === 0 ? (
                  <EmptyRow colSpan={3} message="No expenses in this period." />
                ) : (
                  categoryRows.map((row) => {
                    const share = total > 0 ? (row.amount / total) * 100 : 0
                    return (
                      <TR key={row.name}>
                        <TD>
                          <span className="font-medium text-saipei-dark-800">
                            {row.name}
                          </span>
                        </TD>
                        <TD align="right" numeric>
                          {formatKes(row.amount)}
                        </TD>
                        <TD align="right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-saipei-gray-200">
                              <div
                                className="h-full rounded-full bg-saipei-red-500"
                                style={{ width: `${share}%` }}
                              />
                            </div>
                            <span className="tabular w-12 text-right text-saipei-gray-600">
                              {share.toFixed(1)}%
                            </span>
                          </div>
                        </TD>
                      </TR>
                    )
                  })
                )}
              </TBody>
            </table>
          </div>
        </Card>

        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="By payment method" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Method</TH>
                  <TH align="right">Entries</TH>
                  <TH align="right">Total</TH>
                </TR>
              </THead>
              <TBody>
                {byMethod.length === 0 ? (
                  <EmptyRow colSpan={3} message="No expenses in this period." />
                ) : (
                  byMethod
                    .map((row) => ({
                      method: row.method,
                      count: row._count._all,
                      amount: toNumber(row._sum.amount),
                    }))
                    .sort((a, b) => b.amount - a.amount)
                    .map((row) => (
                      <TR key={row.method}>
                        <TD>
                          <span className="font-medium text-saipei-dark-800">
                            {humanize(row.method)}
                          </span>
                        </TD>
                        <TD align="right" numeric>
                          {formatNumber(row.count)}
                        </TD>
                        <TD align="right" numeric>
                          {formatKes(row.amount)}
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
          <CardHeader title="All expenses in the period" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <THead>
              <TR>
                <TH>Reference</TH>
                <TH>Date</TH>
                <TH>Category</TH>
                <TH>Description</TH>
                <TH>Payee</TH>
                <TH>Method</TH>
                <TH align="right">Amount</TH>
              </TR>
            </THead>
            <TBody>
              {expenses.length === 0 ? (
                <EmptyRow colSpan={7} message="No expenses in this period." />
              ) : (
                expenses.map((expense) => (
                  <TR key={expense.id}>
                    <TD>
                      <span className="tabular font-medium text-saipei-dark-700">
                        {expense.reference}
                      </span>
                    </TD>
                    <TD>{formatDate(expense.expenseDate)}</TD>
                    <TD>{expense.category.name}</TD>
                    <TD>{expense.description}</TD>
                    <TD>{expense.payeeName ?? '—'}</TD>
                    <TD>{humanize(expense.method)}</TD>
                    <TD align="right" numeric>
                      <span className="text-saipei-red-600">
                        {formatKes(expense.amount)}
                      </span>
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
