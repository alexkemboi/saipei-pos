import type { Metadata } from 'next'
import { Banknote, Scale, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { ListFilters } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { PrintButton } from '@/components/ui/print-button'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { resolveRange, REVENUE_STATUSES } from '@/lib/queries/reports'
import { formatDate, formatDateTime, formatKes, formatNumber, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Reconciliation' }
export const dynamic = 'force-dynamic'

export default async function FinanceReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requirePermission('finance.reconcile')
  const params = await searchParams
  const range = resolveRange(params)

  const [sales, receipts, byMethod, sessions, debtors, creditSales] = await Promise.all([
    db.sale.aggregate({
      where: {
        saleDate: { gte: range.from, lte: range.to },
        status: { in: REVENUE_STATUSES },
      },
      _sum: { total: true, amountPaid: true },
      _count: true,
    }),
    db.receipt.aggregate({
      where: {
        receiptDate: { gte: range.from, lte: range.to },
        status: 'COMPLETED',
      },
      _sum: { amount: true },
      _count: true,
    }),
    db.receipt.groupBy({
      by: ['method'],
      where: {
        receiptDate: { gte: range.from, lte: range.to },
        status: 'COMPLETED',
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.cashSession.findMany({
      where: { status: 'CLOSED', closedAt: { gte: range.from, lte: range.to } },
      orderBy: { closedAt: 'desc' },
      select: {
        id: true,
        reference: true,
        openingFloat: true,
        expectedCash: true,
        closingCount: true,
        variance: true,
        closedAt: true,
        user: { select: { fullName: true } },
      },
    }),
    db.customer.aggregate({ where: { balance: { gt: 0 } }, _sum: { balance: true } }),
    db.sale.aggregate({
      where: { status: { in: ['CREDIT', 'PARTIALLY_PAID'] } },
      _sum: { total: true, amountPaid: true },
    }),
  ])

  const salesValue = toNumber(sales._sum.total)
  const receiptsValue = toNumber(receipts._sum.amount)

  // Customer ledger check: outstanding sale balances should equal the sum of
  // customer account balances. A difference means a payment or credit note was
  // applied to one side only.
  const openSaleBalance =
    toNumber(creditSales._sum.total) - toNumber(creditSales._sum.amountPaid)
  const customerBalance = toNumber(debtors._sum.balance)
  const ledgerDifference = Math.round((openSaleBalance - customerBalance) * 100) / 100

  const cashVariance = sessions.reduce((sum, s) => sum + toNumber(s.variance), 0)
  const unbalanced = sessions.filter((s) => Math.abs(toNumber(s.variance)) > 0.009)

  return (
    <>
      <PageHeader
        breadcrumb="Finance & Expenses"
        title="Reconciliation"
        description={`Money taken against money recorded, ${formatDate(range.from)} to ${formatDate(range.to)}.`}
        action={<PrintButton label="Print reconciliation" />}
      />

      <div className="no-print">
        <ListFilters showSearch={false} showDateRange />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sales value"
          value={formatKes(salesValue)}
          sublabel={`${formatNumber(sales._count)} transactions`}
          tone="dark"
          icon={<Scale className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Money received"
          value={formatKes(receiptsValue)}
          sublabel={`${formatNumber(receipts._count)} receipts`}
          tone="green"
          icon={<Wallet className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Cash variance"
          value={formatKes(cashVariance)}
          sublabel={`${formatNumber(unbalanced.length)} sessions out of balance`}
          tone={Math.abs(cashVariance) < 1 ? 'green' : 'red'}
          icon={<Banknote className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Customer ledger"
          value={formatKes(Math.abs(ledgerDifference))}
          sublabel={
            Math.abs(ledgerDifference) < 0.01
              ? 'sales and balances agree'
              : 'sales and balances disagree'
          }
          tone={Math.abs(ledgerDifference) < 0.01 ? 'green' : 'red'}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Receipts by method"
              description="What was banked, and how it came in."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Method</TH>
                  <TH align="right">Receipts</TH>
                  <TH align="right">Amount</TH>
                  <TH align="right">Share</TH>
                </TR>
              </THead>
              <TBody>
                {byMethod.length === 0 ? (
                  <EmptyRow colSpan={4} message="No receipts in this period." />
                ) : (
                  byMethod
                    .map((row) => ({
                      method: row.method,
                      count: row._count._all,
                      amount: toNumber(row._sum.amount),
                    }))
                    .sort((a, b) => b.amount - a.amount)
                    .map((row) => {
                      const share =
                        receiptsValue > 0 ? (row.amount / receiptsValue) * 100 : 0
                      return (
                        <TR key={row.method}>
                          <TD>
                            <span className="font-medium text-saipei-dark-800">
                              {row.method.replace(/_/g, ' ')}
                            </span>
                          </TD>
                          <TD align="right" numeric>
                            {formatNumber(row.count)}
                          </TD>
                          <TD align="right" numeric>
                            {formatKes(row.amount)}
                          </TD>
                          <TD align="right" numeric>
                            {share.toFixed(1)}%
                          </TD>
                        </TR>
                      )
                    })
                )}
              </TBody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Customer ledger check"
            description="Outstanding credit sales should equal the sum of customer balances."
          />
          <dl className="space-y-2.5 text-sm">
            <Row label="Balance on open credit sales" value={formatKes(openSaleBalance)} />
            <Row label="Sum of customer account balances" value={formatKes(customerBalance)} />
            <div className="flex items-baseline justify-between border-t border-saipei-gray-200 pt-2.5">
              <dt className="font-semibold text-saipei-dark-800">Difference</dt>
              <dd
                className={
                  'tabular text-xl font-bold ' +
                  (Math.abs(ledgerDifference) < 0.01
                    ? 'text-saipei-green-700'
                    : 'text-saipei-red-600')
                }
              >
                {formatKes(ledgerDifference)}
              </dd>
            </div>
          </dl>
          <div className="mt-4">
            {Math.abs(ledgerDifference) < 0.01 ? (
              <Badge tone="success">The customer ledger balances</Badge>
            ) : (
              <Badge tone="danger">
                Investigate: a payment or credit note has been applied to one side only
              </Badge>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-5">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Till sessions closed in this period"
              description="Counted cash against what the system expected."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Session</TH>
                  <TH>Cashier</TH>
                  <TH>Closed</TH>
                  <TH align="right">Float</TH>
                  <TH align="right">Expected</TH>
                  <TH align="right">Counted</TH>
                  <TH align="right">Variance</TH>
                  <TH>Outcome</TH>
                </TR>
              </THead>
              <TBody>
                {sessions.length === 0 ? (
                  <EmptyRow colSpan={8} message="No sessions were closed in this period." />
                ) : (
                  sessions.map((session) => {
                    const variance = toNumber(session.variance)
                    const balanced = Math.abs(variance) < 0.01
                    return (
                      <TR key={session.id}>
                        <TD>
                          <span className="tabular font-semibold text-saipei-dark-700">
                            {session.reference}
                          </span>
                        </TD>
                        <TD>{session.user.fullName}</TD>
                        <TD>
                          {session.closedAt ? formatDateTime(session.closedAt) : '—'}
                        </TD>
                        <TD align="right" numeric>
                          {formatKes(session.openingFloat)}
                        </TD>
                        <TD align="right" numeric>
                          {formatKes(session.expectedCash)}
                        </TD>
                        <TD align="right" numeric>
                          {session.closingCount !== null
                            ? formatKes(session.closingCount)
                            : '—'}
                        </TD>
                        <TD align="right" numeric>
                          <span
                            className={
                              balanced
                                ? 'text-saipei-gray-500'
                                : variance > 0
                                  ? 'text-saipei-amber-700'
                                  : 'text-saipei-red-600'
                            }
                          >
                            {variance > 0 ? '+' : ''}
                            {formatKes(variance)}
                          </span>
                        </TD>
                        <TD>
                          {balanced ? (
                            <Badge tone="success">Balanced</Badge>
                          ) : variance > 0 ? (
                            <Badge tone="warning">Over</Badge>
                          ) : (
                            <Badge tone="danger">Short</Badge>
                          )}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-saipei-gray-500">{label}</dt>
      <dd className="tabular font-medium text-saipei-gray-900">{value}</dd>
    </div>
  )
}
