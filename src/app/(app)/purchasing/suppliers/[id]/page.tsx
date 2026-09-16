import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Banknote, Pencil, Ship } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Supplier' }
export const dynamic = 'force-dynamic'

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('suppliers.manage')
  const { id } = await params

  const supplier = await db.supplier.findUnique({
    where: { id },
    include: {
      purchaseOrders: {
        orderBy: { orderDate: 'desc' },
        take: 10,
        select: {
          id: true,
          reference: true,
          orderDate: true,
          currency: true,
          total: true,
          status: true,
        },
      },
      invoices: {
        orderBy: { invoiceDate: 'desc' },
        take: 10,
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          dueDate: true,
          currency: true,
          amount: true,
          amountPaid: true,
          status: true,
        },
      },
      payments: {
        orderBy: { paymentDate: 'desc' },
        take: 10,
        select: {
          id: true,
          reference: true,
          paymentDate: true,
          method: true,
          currency: true,
          amount: true,
          amountKes: true,
          isDeposit: true,
        },
      },
      importOrders: {
        orderBy: { orderDate: 'desc' },
        take: 10,
        select: { id: true, reference: true, orderDate: true, stage: true },
      },
    },
  })

  if (!supplier) notFound()

  const allInvoices = await db.supplierInvoice.findMany({
    where: { supplierId: id },
    select: { amount: true, amountPaid: true, exchangeRate: true, status: true },
  })

  const payable = allInvoices
    .filter((i) => i.status === 'UNPAID' || i.status === 'PARTIALLY_PAID')
    .reduce(
      (sum, i) =>
        sum + (toNumber(i.amount) - toNumber(i.amountPaid)) * toNumber(i.exchangeRate),
      0,
    )
  const invoicedTotal = allInvoices.reduce(
    (sum, i) => sum + toNumber(i.amount) * toNumber(i.exchangeRate),
    0,
  )
  const paidTotal = await db.payment.aggregate({
    where: { supplierId: id },
    _sum: { amountKes: true },
  })

  return (
    <>
      <PageHeader
        breadcrumb={`Purchasing · Suppliers · ${supplier.code}`}
        title={supplier.name}
        description={[
          humanize(supplier.type),
          supplier.country,
          supplier.contactName,
          supplier.phone,
        ]
          .filter(Boolean)
          .join(' · ')}
        action={
          <>
            <Link href="/purchasing/suppliers">
              <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" aria-hidden />}>
                Back
              </Button>
            </Link>
            <Link href={`/purchasing/suppliers/${supplier.id}/edit`}>
              <Button variant="secondary" icon={<Pencil className="h-4 w-4" aria-hidden />}>
                Edit
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Owed to this supplier"
          value={formatKes(payable)}
          sublabel="unpaid and part-paid invoices"
          tone={payable > 0 ? 'red' : 'green'}
          icon={<Banknote className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Total invoiced"
          value={formatKes(invoicedTotal)}
          sublabel={`${formatNumber(allInvoices.length)} invoices`}
          tone="dark"
        />
        <StatCard
          label="Total paid"
          value={formatKes(toNumber(paidTotal._sum.amountKes))}
          sublabel="including deposits"
          tone="green"
        />
        <StatCard
          label="Import orders"
          value={formatNumber(supplier.importOrders.length)}
          sublabel="consignments from this supplier"
          tone="dark"
          icon={<Ship className="h-4 w-4" aria-hidden />}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Purchase orders" description="The last ten orders." />
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
                {supplier.purchaseOrders.length === 0 ? (
                  <EmptyRow colSpan={4} message="No purchase orders yet." />
                ) : (
                  supplier.purchaseOrders.map((order) => (
                    <TR key={order.id}>
                      <TD>
                        <span className="tabular font-medium text-saipei-dark-700">
                          {order.reference}
                        </span>
                      </TD>
                      <TD>{formatDate(order.orderDate)}</TD>
                      <TD align="right" numeric>
                        {order.currency} {formatNumber(order.total, 2)}
                      </TD>
                      <TD>
                        <StatusBadge status={order.status} />
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
            <CardHeader title="Invoices" description="The last ten invoices." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Invoice</TH>
                  <TH>Date</TH>
                  <TH align="right">Amount</TH>
                  <TH align="right">Balance</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {supplier.invoices.length === 0 ? (
                  <EmptyRow colSpan={5} message="No invoices captured yet." />
                ) : (
                  supplier.invoices.map((invoice) => (
                    <TR key={invoice.id}>
                      <TD>
                        <span className="tabular font-medium text-saipei-dark-700">
                          {invoice.invoiceNumber}
                        </span>
                      </TD>
                      <TD>{formatDate(invoice.invoiceDate)}</TD>
                      <TD align="right" numeric>
                        {invoice.currency} {formatNumber(invoice.amount, 2)}
                      </TD>
                      <TD align="right" numeric>
                        {formatNumber(
                          toNumber(invoice.amount) - toNumber(invoice.amountPaid),
                          2,
                        )}
                      </TD>
                      <TD>
                        <StatusBadge status={invoice.status} />
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
            <CardHeader title="Payments" description="The last ten payments made." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Reference</TH>
                  <TH>Date</TH>
                  <TH>Method</TH>
                  <TH align="right">Amount</TH>
                  <TH align="right">KES</TH>
                </TR>
              </THead>
              <TBody>
                {supplier.payments.length === 0 ? (
                  <EmptyRow colSpan={5} message="No payments made yet." />
                ) : (
                  supplier.payments.map((payment) => (
                    <TR key={payment.id}>
                      <TD>
                        <span className="tabular font-medium text-saipei-dark-700">
                          {payment.reference}
                        </span>
                        {payment.isDeposit ? (
                          <span className="block text-xs text-saipei-gray-500">deposit</span>
                        ) : null}
                      </TD>
                      <TD>{formatDate(payment.paymentDate)}</TD>
                      <TD>{humanize(payment.method)}</TD>
                      <TD align="right" numeric>
                        {payment.currency} {formatNumber(payment.amount, 2)}
                      </TD>
                      <TD align="right" numeric>
                        {formatKes(payment.amountKes)}
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
            <CardHeader title="Import orders" description="Consignments from this supplier." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Reference</TH>
                  <TH>Ordered</TH>
                  <TH>Stage</TH>
                </TR>
              </THead>
              <TBody>
                {supplier.importOrders.length === 0 ? (
                  <EmptyRow colSpan={3} message="No import orders from this supplier." />
                ) : (
                  supplier.importOrders.map((order) => (
                    <TR key={order.id}>
                      <TD>
                        <Link
                          href={`/imports/${order.id}`}
                          className="tabular font-medium text-saipei-dark-700 hover:underline"
                        >
                          {order.reference}
                        </Link>
                      </TD>
                      <TD>{formatDate(order.orderDate)}</TD>
                      <TD>
                        <StatusBadge status={order.stage} />
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
