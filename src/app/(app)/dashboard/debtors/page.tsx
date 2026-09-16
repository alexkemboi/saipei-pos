import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, Users, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/page'
import { PrintButton } from '@/components/ui/print-button'
import { EmptyRow, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, formatKes, formatNumber, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Debtors' }
export const dynamic = 'force-dynamic'

/** Standard receivables ageing buckets. */
const BUCKETS = [
  { label: 'Current', min: 0, max: 30 },
  { label: '31–60 days', min: 31, max: 60 },
  { label: '61–90 days', min: 61, max: 90 },
  { label: 'Over 90 days', min: 91, max: Infinity },
]

export default async function DebtorsPage() {
  await requirePermission('dashboard.view')

  const [customers, openSales] = await Promise.all([
    db.customer.findMany({
      where: { balance: { gt: 0 } },
      orderBy: { balance: 'desc' },
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        balance: true,
        creditLimit: true,
      },
    }),
    db.sale.findMany({
      where: { status: { in: ['CREDIT', 'PARTIALLY_PAID'] } },
      select: {
        id: true,
        reference: true,
        saleDate: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        customerId: true,
        customer: { select: { name: true } },
      },
    }),
  ])

  const now = Date.now()
  const day = 1000 * 60 * 60 * 24

  // Age each open sale from its due date, or its sale date when none was set.
  const aged = openSales.map((sale) => {
    const reference = sale.dueDate ?? sale.saleDate
    const ageDays = Math.max(0, Math.floor((now - reference.getTime()) / day))
    return {
      ...sale,
      ageDays,
      balance: toNumber(sale.total) - toNumber(sale.amountPaid),
    }
  })

  const bucketTotals = BUCKETS.map((bucket) => ({
    label: bucket.label,
    amount: aged
      .filter((sale) => sale.ageDays >= bucket.min && sale.ageDays <= bucket.max)
      .reduce((sum, sale) => sum + sale.balance, 0),
    count: aged.filter(
      (sale) => sale.ageDays >= bucket.min && sale.ageDays <= bucket.max,
    ).length,
  }))

  const totalOwed = customers.reduce((sum, c) => sum + toNumber(c.balance), 0)
  const overLimit = customers.filter(
    (c) => toNumber(c.creditLimit) > 0 && toNumber(c.balance) > toNumber(c.creditLimit),
  )
  const oldest = [...aged].sort((a, b) => b.ageDays - a.ageDays).slice(0, 15)

  return (
    <>
      <PageHeader
        breadcrumb="Dashboard"
        title="Debtors"
        description="Who owes SAIPEI money, and how long it has been outstanding."
        action={
          <>
            <PrintButton label="Print ageing" />
            <Link href="/sales/payments">
              <Button icon={<Wallet className="h-4 w-4" aria-hidden />}>
                Record a payment
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total owed"
          value={formatKes(totalOwed)}
          sublabel={`${formatNumber(customers.length)} customers on credit`}
          tone="red"
          icon={<Wallet className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Over 90 days"
          value={formatKes(bucketTotals[3]?.amount ?? 0)}
          sublabel={`${formatNumber(bucketTotals[3]?.count ?? 0)} invoices`}
          tone={(bucketTotals[3]?.amount ?? 0) > 0 ? 'red' : 'green'}
          icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Over their credit limit"
          value={formatNumber(overLimit.length)}
          sublabel="accounts to stop selling to on credit"
          tone={overLimit.length > 0 ? 'red' : 'green'}
          icon={<Users className="h-4 w-4" aria-hidden />}
        />
      </div>

      <div className="mb-5">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Ageing"
              description="Measured from the due date, or the sale date where none was set."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  {bucketTotals.map((bucket) => (
                    <TH key={bucket.label} align="right">
                      {bucket.label}
                    </TH>
                  ))}
                  <TH align="right">Total</TH>
                </TR>
              </THead>
              <TBody>
                <TR>
                  {bucketTotals.map((bucket, index) => (
                    <TD key={bucket.label} align="right" numeric>
                      <span
                        className={
                          index >= 2 && bucket.amount > 0
                            ? 'text-saipei-red-600'
                            : index === 1 && bucket.amount > 0
                              ? 'text-saipei-amber-700'
                              : undefined
                        }
                      >
                        {formatKes(bucket.amount)}
                      </span>
                      <span className="block text-xs text-saipei-gray-400">
                        {formatNumber(bucket.count)} invoice
                        {bucket.count === 1 ? '' : 's'}
                      </span>
                    </TD>
                  ))}
                  <TD align="right" numeric>
                    <span className="font-bold text-saipei-dark-800">
                      {formatKes(bucketTotals.reduce((s, b) => s + b.amount, 0))}
                    </span>
                  </TD>
                </TR>
              </TBody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Customers owing money" description="Largest balance first." />
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Customer</TH>
                  <TH align="right">Balance</TH>
                  <TH align="right">Limit</TH>
                  <TH>Standing</TH>
                </TR>
              </THead>
              <TBody>
                {customers.length === 0 ? (
                  <EmptyRow colSpan={4} message="Nobody owes SAIPEI anything." />
                ) : (
                  customers.map((customer) => {
                    const balance = toNumber(customer.balance)
                    const limit = toNumber(customer.creditLimit)
                    return (
                      <TR key={customer.id}>
                        <TD>
                          <Link
                            href={`/sales/customers/${customer.id}`}
                            className="font-medium text-saipei-dark-700 hover:underline"
                          >
                            {customer.name}
                          </Link>
                          {customer.phone ? (
                            <span className="tabular block text-xs text-saipei-gray-500">
                              {customer.phone}
                            </span>
                          ) : null}
                        </TD>
                        <TD align="right" numeric>
                          <span className="text-saipei-red-600">
                            {formatKes(balance)}
                          </span>
                        </TD>
                        <TD align="right" numeric>
                          {limit > 0 ? formatKes(limit) : '—'}
                        </TD>
                        <TD>
                          {limit > 0 && balance > limit ? (
                            <Badge tone="danger">Over limit</Badge>
                          ) : (
                            <Badge tone="warning">Owing</Badge>
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

        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Oldest unpaid sales"
              description="The debts that have been outstanding longest."
            />
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Reference</TH>
                  <TH>Customer</TH>
                  <TH>Sold</TH>
                  <TH align="right">Age</TH>
                  <TH align="right">Balance</TH>
                </TR>
              </THead>
              <TBody>
                {oldest.length === 0 ? (
                  <EmptyRow colSpan={5} message="No credit sales are outstanding." />
                ) : (
                  oldest.map((sale) => (
                    <TR key={sale.id}>
                      <TD>
                        <Link
                          href={`/sales/${sale.id}`}
                          className="tabular font-medium text-saipei-dark-700 hover:underline"
                        >
                          {sale.reference}
                        </Link>
                      </TD>
                      <TD>{sale.customer?.name ?? '—'}</TD>
                      <TD>{formatDate(sale.saleDate)}</TD>
                      <TD align="right" numeric>
                        <span
                          className={
                            sale.ageDays > 90
                              ? 'font-semibold text-saipei-red-600'
                              : sale.ageDays > 60
                                ? 'text-saipei-amber-700'
                                : 'text-saipei-gray-600'
                          }
                        >
                          {formatNumber(sale.ageDays)}d
                        </span>
                      </TD>
                      <TD align="right" numeric>
                        {formatKes(sale.balance)}
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
