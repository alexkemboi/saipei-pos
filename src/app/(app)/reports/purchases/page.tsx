import type { Metadata } from 'next'
import { Banknote, FileSpreadsheet, ShoppingCart } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { ListFilters } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { PrintButton } from '@/components/ui/print-button'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { resolveRange } from '@/lib/queries/reports'
import { formatDate, formatKes, formatNumber, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Purchase reports' }
export const dynamic = 'force-dynamic'

export default async function PurchaseReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requirePermission('reports.view')
  const params = await searchParams
  const range = resolveRange(params)

  const [orders, invoices, payments, byStatus] = await Promise.all([
    db.purchaseOrder.findMany({
      where: { orderDate: { gte: range.from, lte: range.to } },
      orderBy: { orderDate: 'desc' },
      select: {
        id: true,
        reference: true,
        orderDate: true,
        currency: true,
        exchangeRate: true,
        total: true,
        status: true,
        supplier: { select: { name: true } },
      },
    }),
    db.supplierInvoice.findMany({
      where: { invoiceDate: { gte: range.from, lte: range.to } },
      select: {
        supplierId: true,
        amount: true,
        amountPaid: true,
        exchangeRate: true,
        supplier: { select: { name: true } },
      },
    }),
    db.payment.aggregate({
      where: {
        payeeType: 'SUPPLIER',
        paymentDate: { gte: range.from, lte: range.to },
      },
      _sum: { amountKes: true },
      _count: true,
    }),
    db.purchaseOrder.groupBy({
      by: ['status'],
      where: { orderDate: { gte: range.from, lte: range.to } },
      _count: { _all: true },
    }),
  ])

  const orderedKes = orders.reduce(
    (sum, order) => sum + toNumber(order.total) * toNumber(order.exchangeRate),
    0,
  )
  const invoicedKes = invoices.reduce(
    (sum, invoice) => sum + toNumber(invoice.amount) * toNumber(invoice.exchangeRate),
    0,
  )

  // Spend per supplier, so the biggest relationships are obvious.
  const bySupplier = new Map<string, { name: string; invoiced: number; outstanding: number }>()
  for (const invoice of invoices) {
    const current =
      bySupplier.get(invoice.supplierId) ??
      { name: invoice.supplier.name, invoiced: 0, outstanding: 0 }
    const rate = toNumber(invoice.exchangeRate)
    current.invoiced += toNumber(invoice.amount) * rate
    current.outstanding +=
      (toNumber(invoice.amount) - toNumber(invoice.amountPaid)) * rate
    bySupplier.set(invoice.supplierId, current)
  }

  const supplierRows = [...bySupplier.values()].sort((a, b) => b.invoiced - a.invoiced)

  return (
    <>
      <PageHeader
        breadcrumb="Reports & Analytics"
        title="Purchase report"
        description={`What was ordered, invoiced and paid, ${formatDate(range.from)} to ${formatDate(range.to)}.`}
        action={<PrintButton label="Print report" />}
      />

      <div className="no-print">
        <ListFilters showSearch={false} showDateRange />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ordered"
          value={formatKes(orderedKes)}
          sublabel={`${formatNumber(orders.length)} purchase orders`}
          tone="dark"
          icon={<ShoppingCart className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Invoiced"
          value={formatKes(invoicedKes)}
          sublabel={`${formatNumber(invoices.length)} supplier invoices`}
          tone="dark"
          icon={<FileSpreadsheet className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Paid out"
          value={formatKes(toNumber(payments._sum.amountKes))}
          sublabel={`${formatNumber(payments._count)} payments`}
          tone="red"
          icon={<Banknote className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Still owed"
          value={formatKes(supplierRows.reduce((sum, row) => sum + row.outstanding, 0))}
          sublabel="on invoices raised in this period"
          tone="red"
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Spend by supplier" description="Invoiced value in the period." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Supplier</TH>
                  <TH align="right">Invoiced</TH>
                  <TH align="right">Outstanding</TH>
                  <TH align="right">Share</TH>
                </TR>
              </THead>
              <TBody>
                {supplierRows.length === 0 ? (
                  <EmptyRow colSpan={4} message="No invoices in this period." />
                ) : (
                  supplierRows.map((row) => {
                    const share = invoicedKes > 0 ? (row.invoiced / invoicedKes) * 100 : 0
                    return (
                      <TR key={row.name}>
                        <TD>
                          <span className="font-medium text-saipei-dark-800">
                            {row.name}
                          </span>
                        </TD>
                        <TD align="right" numeric>
                          {formatKes(row.invoiced)}
                        </TD>
                        <TD align="right" numeric>
                          <span
                            className={
                              row.outstanding > 0 ? 'text-saipei-red-600' : undefined
                            }
                          >
                            {formatKes(row.outstanding)}
                          </span>
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

        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Orders by status" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Status</TH>
                  <TH align="right">Orders</TH>
                </TR>
              </THead>
              <TBody>
                {byStatus.length === 0 ? (
                  <EmptyRow colSpan={2} message="No purchase orders in this period." />
                ) : (
                  byStatus.map((row) => (
                    <TR key={row.status}>
                      <TD>
                        <StatusBadge status={row.status} />
                      </TD>
                      <TD align="right" numeric>
                        {formatNumber(row._count._all)}
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
          <CardHeader title="Purchase orders in the period" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <THead>
              <TR>
                <TH>Reference</TH>
                <TH>Supplier</TH>
                <TH>Date</TH>
                <TH align="right">Total</TH>
                <TH align="right">KES</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {orders.length === 0 ? (
                <EmptyRow colSpan={6} message="No purchase orders in this period." />
              ) : (
                orders.map((order) => (
                  <TR key={order.id}>
                    <TD>
                      <span className="tabular font-semibold text-saipei-dark-700">
                        {order.reference}
                      </span>
                    </TD>
                    <TD>{order.supplier.name}</TD>
                    <TD>{formatDate(order.orderDate)}</TD>
                    <TD align="right" numeric>
                      {order.currency} {formatNumber(order.total, 2)}
                    </TD>
                    <TD align="right" numeric>
                      {formatKes(toNumber(order.total) * toNumber(order.exchangeRate))}
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
    </>
  )
}
