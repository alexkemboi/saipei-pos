import type { Metadata } from 'next'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDateTime, formatKes, humanize, toNumber } from '@/lib/utils'
import { CustomerPaymentForm } from './payment-form'

export const metadata: Metadata = { title: 'Customer payments' }
export const dynamic = 'force-dynamic'

export default async function CustomerPaymentsPage() {
  await requirePermission('finance.payments')

  const [customers, recent] = await Promise.all([
    db.customer.findMany({
      where: { isActive: true, balance: { gt: 0 } },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, balance: true },
    }),
    db.receipt.findMany({
      where: { customerId: { not: null } },
      orderBy: { receiptDate: 'desc' },
      take: 15,
      select: {
        id: true,
        reference: true,
        receiptDate: true,
        method: true,
        amount: true,
        mpesaCode: true,
        customer: { select: { name: true } },
      },
    }),
  ])

  return (
    <>
      <PageHeader
        breadcrumb="Sales & POS"
        title="Customer payments"
        description="Collect money against outstanding customer balances."
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <CustomerPaymentForm
          customers={customers.map((c) => ({
            id: c.id,
            code: c.code,
            name: c.name,
            balance: toNumber(c.balance),
          }))}
        />

        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Recent customer receipts"
              description="The last fifteen payments received."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Receipt</TH>
                  <TH>Customer</TH>
                  <TH>Date</TH>
                  <TH>Method</TH>
                  <TH align="right">Amount</TH>
                </TR>
              </THead>
              <TBody>
                {recent.length === 0 ? (
                  <EmptyRow colSpan={5} message="No customer payments recorded yet." />
                ) : (
                  recent.map((receipt) => (
                    <TR key={receipt.id}>
                      <TD>
                        <span className="tabular font-medium text-saipei-dark-700">
                          {receipt.reference}
                        </span>
                      </TD>
                      <TD>{receipt.customer?.name ?? '—'}</TD>
                      <TD>{formatDateTime(receipt.receiptDate)}</TD>
                      <TD>
                        {humanize(receipt.method)}
                        {receipt.mpesaCode ? (
                          <span className="tabular block text-xs text-saipei-gray-500">
                            {receipt.mpesaCode}
                          </span>
                        ) : null}
                      </TD>
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
