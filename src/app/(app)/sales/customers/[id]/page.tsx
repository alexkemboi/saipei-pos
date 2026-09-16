import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Pencil, Wallet } from 'lucide-react'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDateTime, formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Customer' }
export const dynamic = 'force-dynamic'

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('customers.manage')
  const { id } = await params

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      sales: {
        orderBy: { saleDate: 'desc' },
        take: 20,
        select: {
          id: true,
          reference: true,
          saleDate: true,
          total: true,
          amountPaid: true,
          status: true,
        },
      },
      receipts: {
        orderBy: { receiptDate: 'desc' },
        take: 20,
        select: {
          id: true,
          reference: true,
          receiptDate: true,
          method: true,
          amount: true,
        },
      },
    },
  })

  if (!customer) notFound()

  const balance = toNumber(customer.balance)
  const limit = toNumber(customer.creditLimit)
  const lifetime = await db.sale.aggregate({
    where: { customerId: id, status: { not: 'VOIDED' } },
    _sum: { total: true },
    _count: true,
  })

  return (
    <>
      <PageHeader
        breadcrumb={`Sales & POS · Customers · ${customer.code}`}
        title={customer.name}
        description={[customer.phone, customer.email].filter(Boolean).join(' · ') || undefined}
        action={
          <>
            <Link href="/sales/customers">
              <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" aria-hidden />}>
                Back
              </Button>
            </Link>
            <Link href={`/sales/customers/${customer.id}/edit`}>
              <Button variant="secondary" icon={<Pencil className="h-4 w-4" aria-hidden />}>
                Edit
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Outstanding balance"
          value={formatKes(balance)}
          sublabel={limit > 0 ? `of a ${formatKes(limit)} limit` : 'no credit limit set'}
          tone={balance > 0 ? 'red' : 'green'}
          icon={<Wallet className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Lifetime sales"
          value={formatKes(toNumber(lifetime._sum.total))}
          sublabel={`${formatNumber(lifetime._count)} transactions`}
          tone="green"
        />
        <StatCard
          label="Credit limit"
          value={limit > 0 ? formatKes(limit) : 'Cash only'}
          sublabel={limit > 0 ? `${formatKes(Math.max(0, limit - balance))} available` : 'no credit extended'}
          tone="dark"
        />
        <StatCard
          label="Account status"
          value={customer.isActive ? 'Active' : 'Inactive'}
          sublabel={customer.taxPin ? `KRA PIN ${customer.taxPin}` : 'no KRA PIN on file'}
          tone={customer.isActive ? 'green' : 'neutral'}
        />
      </div>

      {limit > 0 && balance > limit ? (
        <div className="mb-5">
          <Badge tone="danger">
            This account is {formatKes(balance - limit)} over its credit limit — take a
            payment before selling on credit again.
          </Badge>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Recent sales" description="The last twenty transactions." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Reference</TH>
                  <TH>Date</TH>
                  <TH align="right">Total</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {customer.sales.length === 0 ? (
                  <EmptyRow colSpan={4} message="This customer has no sales yet." />
                ) : (
                  customer.sales.map((sale) => (
                    <TR key={sale.id}>
                      <TD>
                        <Link
                          href={`/sales/${sale.id}`}
                          className="tabular font-medium text-saipei-dark-700 hover:underline"
                        >
                          {sale.reference}
                        </Link>
                      </TD>
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

        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Payments received" description="The last twenty receipts." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Receipt</TH>
                  <TH>Date</TH>
                  <TH>Method</TH>
                  <TH align="right">Amount</TH>
                </TR>
              </THead>
              <TBody>
                {customer.receipts.length === 0 ? (
                  <EmptyRow colSpan={4} message="No payments recorded for this customer." />
                ) : (
                  customer.receipts.map((receipt) => (
                    <TR key={receipt.id}>
                      <TD>
                        <span className="tabular font-medium text-saipei-dark-700">
                          {receipt.reference}
                        </span>
                      </TD>
                      <TD>{formatDateTime(receipt.receiptDate)}</TD>
                      <TD>{humanize(receipt.method)}</TD>
                      <TD align="right" numeric>
                        {formatKes(receipt.amount)}
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
