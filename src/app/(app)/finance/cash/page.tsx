import type { Metadata } from 'next'
import { PiggyBank, Wallet } from 'lucide-react'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDateTime, formatKes, formatNumber, toNumber } from '@/lib/utils'
import { CashSessionPanel } from './cash-panel'

export const metadata: Metadata = { title: 'Cash management' }
export const dynamic = 'force-dynamic'

export default async function CashPage() {
  const user = await requirePermission('finance.cash')

  const [openSession, history, todayCash] = await Promise.all([
    db.cashSession.findFirst({
      where: { userId: user.id, status: 'OPEN' },
      select: { id: true, reference: true, openingFloat: true, openedAt: true },
    }),
    db.cashSession.findMany({
      orderBy: { openedAt: 'desc' },
      take: 15,
      select: {
        id: true,
        reference: true,
        openingFloat: true,
        closingCount: true,
        expectedCash: true,
        variance: true,
        status: true,
        openedAt: true,
        closedAt: true,
        user: { select: { fullName: true } },
        _count: { select: { sales: true } },
      },
    }),
    db.receipt.aggregate({
      where: {
        method: 'CASH',
        status: 'COMPLETED',
        receiptDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      _sum: { amount: true },
    }),
  ])

  // Cash taken since the current session opened, so the drawer can be counted.
  const sessionCash = openSession
    ? await db.receipt.aggregate({
        where: { cashSessionId: openSession.id, method: 'CASH', status: 'COMPLETED' },
        _sum: { amount: true },
      })
    : null

  const expected = openSession
    ? toNumber(openSession.openingFloat) + toNumber(sessionCash?._sum.amount)
    : 0

  const closed = history.filter((s) => s.status === 'CLOSED')
  const totalVariance = closed.reduce((sum, s) => sum + toNumber(s.variance), 0)

  return (
    <>
      <PageHeader
        breadcrumb="Finance & Expenses"
        title="Cash management"
        description="Open a till float, and count the drawer down at the end of the shift."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Cash taken today"
          value={formatKes(toNumber(todayCash._sum.amount))}
          sublabel="across every till"
          tone="green"
          icon={<Wallet className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Your session"
          value={openSession ? openSession.reference : 'None open'}
          sublabel={
            openSession
              ? `opened ${formatDateTime(openSession.openedAt)}`
              : 'open one before selling'
          }
          tone={openSession ? 'green' : 'amber'}
          icon={<PiggyBank className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Variance, last 15 sessions"
          value={formatKes(totalVariance)}
          sublabel={`${formatNumber(closed.length)} closed sessions`}
          tone={Math.abs(totalVariance) < 1 ? 'green' : 'red'}
        />
      </div>

      <div className="mb-6">
        <CashSessionPanel
          session={
            openSession
              ? {
                  id: openSession.id,
                  reference: openSession.reference,
                  openingFloat: toNumber(openSession.openingFloat),
                  cashTaken: toNumber(sessionCash?._sum.amount),
                  expected,
                }
              : null
          }
        />
      </div>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Recent sessions"
            description="The last fifteen till sessions across all cashiers."
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <THead>
              <TR>
                <TH>Session</TH>
                <TH>Cashier</TH>
                <TH>Opened</TH>
                <TH>Closed</TH>
                <TH align="right">Sales</TH>
                <TH align="right">Float</TH>
                <TH align="right">Expected</TH>
                <TH align="right">Counted</TH>
                <TH align="right">Variance</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {history.length === 0 ? (
                <EmptyRow colSpan={10} message="No cash sessions recorded yet." />
              ) : (
                history.map((session) => {
                  const variance = toNumber(session.variance)
                  return (
                    <TR key={session.id}>
                      <TD>
                        <span className="tabular font-semibold text-saipei-dark-700">
                          {session.reference}
                        </span>
                      </TD>
                      <TD>{session.user.fullName}</TD>
                      <TD>{formatDateTime(session.openedAt)}</TD>
                      <TD>{session.closedAt ? formatDateTime(session.closedAt) : '—'}</TD>
                      <TD align="right" numeric>
                        {formatNumber(session._count.sales)}
                      </TD>
                      <TD align="right" numeric>
                        {formatKes(session.openingFloat)}
                      </TD>
                      <TD align="right" numeric>
                        {session.status === 'CLOSED' ? formatKes(session.expectedCash) : '—'}
                      </TD>
                      <TD align="right" numeric>
                        {session.closingCount !== null
                          ? formatKes(session.closingCount)
                          : '—'}
                      </TD>
                      <TD align="right" numeric>
                        {session.status === 'CLOSED' ? (
                          variance === 0 ? (
                            <Badge tone="success">Balanced</Badge>
                          ) : (
                            <span
                              className={
                                variance > 0
                                  ? 'text-saipei-amber-700'
                                  : 'text-saipei-red-600'
                              }
                            >
                              {variance > 0 ? '+' : ''}
                              {formatKes(variance)}
                            </span>
                          )
                        ) : (
                          '—'
                        )}
                      </TD>
                      <TD>
                        <StatusBadge status={session.status} />
                      </TD>
                    </TR>
                  )
                })
              )}
            </TBody>
          </table>
        </div>
      </Card>
    </>
  )
}
