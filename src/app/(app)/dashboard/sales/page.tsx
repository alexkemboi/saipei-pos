import type { Metadata } from 'next'
import Link from 'next/link'
import { BarChart3, Receipt, ShoppingCart } from 'lucide-react'
import { BarChart } from '@/components/ui/bar-chart'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { getDailySales, REVENUE_STATUSES } from '@/lib/queries/reports'
import { formatDateTime, formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Sales overview' }
export const dynamic = 'force-dynamic'

export default async function SalesOverviewPage() {
  const user = await requirePermission('dashboard.view')

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const last30 = new Date(startOfToday)
  last30.setDate(last30.getDate() - 29)

  const [daily, today, month, byMethod, recent] = await Promise.all([
    getDailySales({ from: last30, to: now }),
    db.sale.aggregate({
      where: { saleDate: { gte: startOfToday }, status: { in: REVENUE_STATUSES } },
      _sum: { total: true, costOfSale: true },
      _count: true,
    }),
    db.sale.aggregate({
      where: {
        saleDate: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        status: { in: REVENUE_STATUSES },
      },
      _sum: { total: true },
      _count: true,
    }),
    db.receipt.groupBy({
      by: ['method'],
      where: { receiptDate: { gte: last30 }, status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    db.sale.findMany({
      where: { status: { not: 'DRAFT' } },
      orderBy: { saleDate: 'desc' },
      take: 12,
      select: {
        id: true,
        reference: true,
        saleDate: true,
        total: true,
        status: true,
        customer: { select: { name: true } },
        cashier: { select: { fullName: true } },
      },
    }),
  ])

  const showProfit = user.permissions.includes('dashboard.financials')
  const revenue30 = daily.reduce((sum, day) => sum + day.revenue, 0)
  const transactions30 = daily.reduce((sum, day) => sum + day.transactions, 0)
  const receiptsTotal = byMethod.reduce((sum, row) => sum + toNumber(row._sum.amount), 0)

  return (
    <>
      <PageHeader
        breadcrumb="Dashboard"
        title="Sales overview"
        description="Trading over the last thirty days."
        action={
          user.permissions.includes('pos.sell') ? (
            <Link href="/pos">
              <Button
                variant="danger"
                icon={<ShoppingCart className="h-4 w-4" aria-hidden />}
              >
                Open POS
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sales today"
          value={formatKes(toNumber(today._sum.total))}
          sublabel={`${formatNumber(today._count)} transactions`}
          tone="green"
          icon={<Receipt className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="This month"
          value={formatKes(toNumber(month._sum.total))}
          sublabel={`${formatNumber(month._count)} transactions`}
          tone="dark"
        />
        <StatCard
          label="Last 30 days"
          value={formatKes(revenue30)}
          sublabel={`${formatNumber(transactions30)} transactions`}
          tone="dark"
          icon={<BarChart3 className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Average sale"
          value={formatKes(transactions30 > 0 ? revenue30 / transactions30 : 0)}
          sublabel="over the last 30 days"
          tone="green"
        />
      </div>

      <div className="mb-5">
        <Card>
          <CardHeader
            title="Daily revenue, last 30 days"
            description={showProfit ? 'Revenue against cost of sales.' : undefined}
          />
          <BarChart
            data={daily.map((day) => ({
              label: day.date.slice(5),
              value: day.revenue,
              ...(showProfit ? { secondary: day.cost } : {}),
            }))}
            valueLabel="Revenue"
            secondaryLabel={showProfit ? 'Cost of sales' : undefined}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.6fr]">
        <Card padded={false} className="self-start">
          <div className="px-5 pt-5">
            <CardHeader
              title="How customers paid"
              description="Receipts over the last 30 days."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Method</TH>
                  <TH align="right">Amount</TH>
                  <TH align="right">Share</TH>
                </TR>
              </THead>
              <TBody>
                {byMethod.length === 0 ? (
                  <EmptyRow colSpan={3} message="No receipts in the last 30 days." />
                ) : (
                  byMethod
                    .map((row) => ({
                      method: row.method,
                      amount: toNumber(row._sum.amount),
                    }))
                    .sort((a, b) => b.amount - a.amount)
                    .map((row) => {
                      const share =
                        receiptsTotal > 0 ? (row.amount / receiptsTotal) * 100 : 0
                      return (
                        <TR key={row.method}>
                          <TD>
                            <span className="font-medium text-saipei-dark-800">
                              {humanize(row.method)}
                            </span>
                          </TD>
                          <TD align="right" numeric>
                            {formatKes(row.amount)}
                          </TD>
                          <TD align="right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-saipei-gray-200">
                                <div
                                  className="h-full rounded-full bg-saipei-green-500"
                                  style={{ width: `${share}%` }}
                                />
                              </div>
                              <span className="tabular w-11 text-right text-saipei-gray-600">
                                {share.toFixed(0)}%
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
            <CardHeader
              title="Latest transactions"
              description="The last twelve sales recorded."
              action={
                <Link href="/sales">
                  <Button variant="ghost" size="sm">
                    View all
                  </Button>
                </Link>
              }
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Reference</TH>
                  <TH>Customer</TH>
                  <TH>Cashier</TH>
                  <TH>When</TH>
                  <TH align="right">Total</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {recent.length === 0 ? (
                  <EmptyRow colSpan={6} message="No sales recorded yet." />
                ) : (
                  recent.map((sale) => (
                    <TR key={sale.id}>
                      <TD>
                        <Link
                          href={`/sales/${sale.id}`}
                          className="tabular font-medium text-saipei-dark-700 hover:underline"
                        >
                          {sale.reference}
                        </Link>
                      </TD>
                      <TD>{sale.customer?.name ?? 'Walk-in customer'}</TD>
                      <TD>{sale.cashier.fullName}</TD>
                      <TD>{formatDateTime(sale.saleDate)}</TD>
                      <TD align="right" numeric>
                        {formatKes(sale.total)}
                      </TD>
                      <TD>
                        <StatusBadge status={sale.status} />
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
