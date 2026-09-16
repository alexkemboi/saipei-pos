import type { Metadata } from 'next'
import { Receipt, TrendingDown } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { ListFilters, Pagination } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'
import { ExpenseForm } from './expense-form'

export const metadata: Metadata = { title: 'Expenses' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const user = await requirePermission('finance.view')
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const where: Record<string, unknown> = {}
  if (params.categoryId) where.categoryId = params.categoryId
  if (params.method) where.method = params.method
  if (params.q) {
    where.OR = [
      { reference: { contains: params.q } },
      { description: { contains: params.q } },
      { payeeName: { contains: params.q } },
    ]
  }
  if (params.from || params.to) {
    const range: Record<string, Date> = {}
    if (params.from) range.gte = new Date(params.from)
    if (params.to) {
      const to = new Date(params.to)
      to.setHours(23, 59, 59, 999)
      range.lte = to
    }
    where.expenseDate = range
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [rows, total, sum, categories, byCategory, thisMonth] = await Promise.all([
    db.expense.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        description: true,
        amount: true,
        method: true,
        expenseDate: true,
        payeeName: true,
        status: true,
        category: { select: { name: true } },
        user: { select: { fullName: true } },
      },
    }),
    db.expense.count({ where }),
    db.expense.aggregate({ where, _sum: { amount: true } }),
    db.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    db.expense.groupBy({ where, by: ['categoryId'], _sum: { amount: true } }),
    db.expense.aggregate({
      where: { expenseDate: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
  ])

  const categoryNames = new Map(categories.map((c) => [c.id, c.name]))
  const topCategories = byCategory
    .map((row) => ({
      name: categoryNames.get(row.categoryId) ?? 'Unknown',
      amount: toNumber(row._sum.amount),
    }))
    .sort((a, b) => b.amount - a.amount)

  return (
    <>
      <PageHeader
        breadcrumb="Finance & Expenses"
        title="Expenses"
        description="Operating costs: transport, rent, salaries, utilities and licences."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Expenses shown"
          value={formatKes(toNumber(sum._sum.amount))}
          sublabel={`${formatNumber(total)} entries`}
          tone="red"
          icon={<Receipt className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="This month"
          value={formatKes(toNumber(thisMonth._sum.amount))}
          sublabel="all expenses since the 1st"
          tone="red"
          icon={<TrendingDown className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Largest category"
          value={topCategories[0]?.name ?? '—'}
          sublabel={topCategories[0] ? formatKes(topCategories[0].amount) : 'no expenses yet'}
          tone="amber"
        />
      </div>

      {user.permissions.includes('finance.expenses') ? (
        <div className="mb-6">
          <ExpenseForm categories={categories} />
        </div>
      ) : null}

      <ListFilters
        searchPlaceholder="Search by reference, description or payee…"
        showDateRange
        selects={[
          {
            name: 'categoryId',
            label: 'Category',
            options: categories.map((c) => ({ value: c.id, label: c.name })),
          },
          {
            name: 'method',
            label: 'Paid by',
            options: [
              { value: 'CASH', label: 'Cash' },
              { value: 'MPESA', label: 'M-PESA' },
              { value: 'BANK_TRANSFER', label: 'Bank transfer' },
              { value: 'CHEQUE', label: 'Cheque' },
              { value: 'CARD', label: 'Card' },
            ],
          },
        ]}
      />

      <Table>
        <THead>
          <TR>
            <TH>Reference</TH>
            <TH>Date</TH>
            <TH>Category</TH>
            <TH>Description</TH>
            <TH>Payee</TH>
            <TH>Paid by</TH>
            <TH>Recorded by</TH>
            <TH align="right">Amount</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={9} message="No expenses match these filters." />
          ) : (
            rows.map((expense) => (
              <TR key={expense.id}>
                <TD>
                  <span className="tabular font-semibold text-saipei-dark-700">
                    {expense.reference}
                  </span>
                </TD>
                <TD>{formatDate(expense.expenseDate)}</TD>
                <TD>{expense.category.name}</TD>
                <TD>{expense.description}</TD>
                <TD>{expense.payeeName ?? '—'}</TD>
                <TD>{humanize(expense.method)}</TD>
                <TD>{expense.user?.fullName ?? '—'}</TD>
                <TD align="right" numeric>
                  <span className="text-saipei-red-600">{formatKes(expense.amount)}</span>
                </TD>
                <TD>
                  <StatusBadge status={expense.status} />
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <Pagination
        page={page}
        pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        total={total}
      />

      {topCategories.length > 0 ? (
        <div className="mt-5">
          <Card padded={false}>
            <div className="px-5 pt-5">
              <CardHeader title="By category" description="For the filters currently applied." />
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
                  {topCategories.map((row) => {
                    const grand = topCategories.reduce((s, r) => s + r.amount, 0)
                    const share = grand > 0 ? (row.amount / grand) * 100 : 0
                    return (
                      <TR key={row.name}>
                        <TD>
                          <span className="font-medium text-saipei-dark-800">{row.name}</span>
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
                  })}
                </TBody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  )
}
