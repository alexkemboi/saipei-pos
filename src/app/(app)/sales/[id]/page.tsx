import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Printer } from 'lucide-react'
import { PaymentBadge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDateTime, formatKes, formatNumber, humanize } from '@/lib/utils'

export const metadata: Metadata = { title: 'Sale' }
export const dynamic = 'force-dynamic'

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('sales.view')
  const { id } = await params

  const sale = await db.sale.findUnique({
    where: { id },
    include: {
      customer: true,
      cashier: { select: { fullName: true } },
      branch: { select: { name: true } },
      lines: { include: { product: { select: { sku: true } } } },
      receipts: { orderBy: { receiptDate: 'asc' } },
      returns: { orderBy: { returnDate: 'asc' } },
    },
  })

  if (!sale) notFound()

  const balance = Number(sale.total) - Number(sale.amountPaid)

  return (
    <>
      <PageHeader
        breadcrumb="Sales & POS"
        title={sale.reference}
        description={`${humanize(sale.channel)} sale · ${formatDateTime(sale.saleDate)}`}
        action={
          <>
            <Link href="/sales">
              <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" aria-hidden />}>
                Back
              </Button>
            </Link>
            <Link href={`/sales/${sale.id}/receipt`}>
              <Button variant="secondary" icon={<Printer className="h-4 w-4" aria-hidden />}>
                Print receipt
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card padded={false}>
            <div className="px-5 pt-5">
              <CardHeader title="Items sold" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <THead>
                  <TR>
                    <TH>SKU</TH>
                    <TH>Item</TH>
                    <TH align="right">Qty</TH>
                    <TH align="right">Unit price</TH>
                    <TH align="right">Discount</TH>
                    <TH align="right">Total</TH>
                  </TR>
                </THead>
                <TBody>
                  {sale.lines.map((line) => (
                    <TR key={line.id}>
                      <TD>
                        <span className="tabular text-saipei-gray-600">
                          {line.product.sku}
                        </span>
                      </TD>
                      <TD>
                        <span className="font-medium text-saipei-dark-800">
                          {line.description}
                        </span>
                      </TD>
                      <TD align="right" numeric>
                        {formatNumber(line.quantity, 0)}
                      </TD>
                      <TD align="right" numeric>
                        {formatKes(line.unitPrice)}
                      </TD>
                      <TD align="right" numeric>
                        {Number(line.discount) > 0 ? `−${formatKes(line.discount)}` : '—'}
                      </TD>
                      <TD align="right" numeric>
                        {formatKes(line.lineTotal)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </table>
            </div>
          </Card>

          <Card padded={false}>
            <div className="px-5 pt-5">
              <CardHeader
                title="Payments received"
                description="Receipts raised against this sale."
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <THead>
                  <TR>
                    <TH>Receipt</TH>
                    <TH>Date</TH>
                    <TH>Method</TH>
                    <TH>M-PESA code</TH>
                    <TH align="right">Amount</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {sale.receipts.length === 0 ? (
                    <EmptyRow
                      colSpan={6}
                      message="No payment has been received against this sale."
                    />
                  ) : (
                    sale.receipts.map((receipt) => (
                      <TR key={receipt.id}>
                        <TD>
                          <span className="tabular font-medium text-saipei-dark-700">
                            {receipt.reference}
                          </span>
                        </TD>
                        <TD>{formatDateTime(receipt.receiptDate)}</TD>
                        <TD>{humanize(receipt.method)}</TD>
                        <TD>
                          <span className="tabular">{receipt.mpesaCode ?? '—'}</span>
                        </TD>
                        <TD align="right" numeric>
                          {formatKes(receipt.amount)}
                        </TD>
                        <TD>
                          <PaymentBadge status={receipt.status} />
                        </TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </table>
            </div>
          </Card>
        </div>

        {/* --- Summary rail --- */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Summary" />
            <dl className="space-y-2.5 text-sm">
              <Row label="Status" value={<StatusBadge status={sale.status} />} />
              <Row label="Customer" value={sale.customer?.name ?? 'Walk-in customer'} />
              <Row label="Served by" value={sale.cashier.fullName} />
              {sale.branch ? <Row label="Branch" value={sale.branch.name} /> : null}
              {sale.dueDate ? (
                <Row label="Due" value={formatDateTime(sale.dueDate)} />
              ) : null}
            </dl>

            <dl className="mt-4 space-y-2 border-t border-saipei-gray-200 pt-4 text-sm">
              <Row label="Subtotal" value={formatKes(sale.subtotal)} numeric />
              {Number(sale.discount) > 0 ? (
                <Row label="Discount" value={`−${formatKes(sale.discount)}`} numeric />
              ) : null}
              <Row label="VAT included" value={formatKes(sale.taxAmount)} numeric />
              <div className="flex items-baseline justify-between border-t border-saipei-gray-200 pt-2.5">
                <dt className="font-semibold text-saipei-dark-800">Total</dt>
                <dd className="tabular text-xl font-bold text-saipei-dark-800">
                  {formatKes(sale.total)}
                </dd>
              </div>
              <Row label="Paid" value={formatKes(sale.amountPaid)} numeric />
              {balance > 0 ? (
                <div className="flex items-baseline justify-between rounded-md bg-saipei-red-50 px-3 py-2">
                  <dt className="font-semibold text-saipei-red-700">Balance due</dt>
                  <dd className="tabular font-bold text-saipei-red-600">
                    {formatKes(balance)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>

          {sale.returns.length > 0 ? (
            <Card>
              <CardHeader title="Returns" />
              <ul className="space-y-2 text-sm">
                {sale.returns.map((ret) => (
                  <li key={ret.id} className="flex justify-between">
                    <span className="tabular text-saipei-gray-600">{ret.reference}</span>
                    <span className="tabular font-medium text-saipei-red-600">
                      −{formatKes(ret.totalAmount)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {sale.notes ? (
            <Card>
              <CardHeader title="Notes" />
              <p className="text-sm text-saipei-gray-600">{sale.notes}</p>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  )
}

function Row({
  label,
  value,
  numeric,
}: {
  label: string
  value: React.ReactNode
  numeric?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-saipei-gray-500">{label}</dt>
      <dd
        className={
          numeric
            ? 'tabular font-medium text-saipei-gray-900'
            : 'text-right font-medium text-saipei-gray-900'
        }
      >
        {value}
      </dd>
    </div>
  )
}
