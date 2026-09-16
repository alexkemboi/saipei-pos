import type { Metadata } from 'next'
import { FileText } from 'lucide-react'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { ListFilters, Pagination } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, formatKes, formatNumber, toNumber } from '@/lib/utils'
import { SupplierInvoiceForm } from './invoice-form'

export const metadata: Metadata = { title: 'Supplier invoices' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function SupplierInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const user = await requirePermission('purchasing.view')
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const where: Record<string, unknown> = {}
  if (params.status) where.status = params.status
  if (params.supplierId) where.supplierId = params.supplierId
  if (params.q) {
    where.OR = [
      { invoiceNumber: { contains: params.q } },
      { supplier: { name: { contains: params.q } } },
    ]
  }

  const [rows, total, suppliers, orders, allOpen] = await Promise.all([
    db.supplierInvoice.findMany({
      where,
      orderBy: { invoiceDate: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        currency: true,
        exchangeRate: true,
        amount: true,
        amountPaid: true,
        isFinal: true,
        status: true,
        supplier: { select: { name: true } },
        purchaseOrder: { select: { reference: true } },
      },
    }),
    db.supplierInvoice.count({ where }),
    db.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, currency: true },
    }),
    db.purchaseOrder.findMany({
      where: { status: { in: ['APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED'] } },
      orderBy: { orderDate: 'desc' },
      select: { id: true, reference: true, supplierId: true },
    }),
    db.supplierInvoice.findMany({
      where: { status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
      select: { amount: true, amountPaid: true, exchangeRate: true, dueDate: true },
    }),
  ])

  const payable = allOpen.reduce(
    (sum, i) =>
      sum + (toNumber(i.amount) - toNumber(i.amountPaid)) * toNumber(i.exchangeRate),
    0,
  )
  const now = Date.now()
  const overdue = allOpen.filter((i) => i.dueDate && i.dueDate.getTime() < now)
  const overdueValue = overdue.reduce(
    (sum, i) =>
      sum + (toNumber(i.amount) - toNumber(i.amountPaid)) * toNumber(i.exchangeRate),
    0,
  )

  return (
    <>
      <PageHeader
        breadcrumb="Purchasing"
        title="Supplier invoices"
        description="Invoices received from suppliers, including the final invoice before shipping."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total payable"
          value={formatKes(payable)}
          sublabel={`${formatNumber(allOpen.length)} open invoices`}
          tone="red"
          icon={<FileText className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Overdue"
          value={formatKes(overdueValue)}
          sublabel={`${formatNumber(overdue.length)} past their due date`}
          tone={overdue.length > 0 ? 'red' : 'green'}
        />
        <StatCard
          label="Invoices shown"
          value={formatNumber(total)}
          sublabel="matching the current filters"
          tone="dark"
        />
      </div>

      {user.permissions.includes('purchasing.manage') ? (
        <div className="mb-6">
          <SupplierInvoiceForm suppliers={suppliers} orders={orders} />
        </div>
      ) : null}

      <ListFilters
        searchPlaceholder="Search by invoice number or supplier…"
        selects={[
          {
            name: 'status',
            label: 'Status',
            options: [
              { value: 'UNPAID', label: 'Unpaid' },
              { value: 'PARTIALLY_PAID', label: 'Partially paid' },
              { value: 'PAID', label: 'Paid' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ],
          },
          {
            name: 'supplierId',
            label: 'Supplier',
            options: suppliers.map((s) => ({ value: s.id, label: s.name })),
          },
        ]}
      />

      <Table>
        <THead>
          <TR>
            <TH>Invoice</TH>
            <TH>Supplier</TH>
            <TH>Against LPO</TH>
            <TH>Date</TH>
            <TH>Due</TH>
            <TH align="right">Amount</TH>
            <TH align="right">Paid</TH>
            <TH align="right">Balance (KES)</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={9} message="No invoices match these filters." />
          ) : (
            rows.map((invoice) => {
              const balance =
                (toNumber(invoice.amount) - toNumber(invoice.amountPaid)) *
                toNumber(invoice.exchangeRate)
              const isOverdue =
                invoice.dueDate &&
                invoice.dueDate.getTime() < now &&
                invoice.status !== 'PAID'

              return (
                <TR key={invoice.id}>
                  <TD>
                    <span className="tabular font-semibold text-saipei-dark-700">
                      {invoice.invoiceNumber}
                    </span>
                    {invoice.isFinal ? (
                      <span className="block text-xs text-saipei-green-700">
                        final invoice
                      </span>
                    ) : null}
                  </TD>
                  <TD>{invoice.supplier.name}</TD>
                  <TD>
                    <span className="tabular text-saipei-gray-600">
                      {invoice.purchaseOrder?.reference ?? '—'}
                    </span>
                  </TD>
                  <TD>{formatDate(invoice.invoiceDate)}</TD>
                  <TD>
                    {invoice.dueDate ? (
                      isOverdue ? (
                        <Badge tone="danger">Overdue {formatDate(invoice.dueDate)}</Badge>
                      ) : (
                        formatDate(invoice.dueDate)
                      )
                    ) : (
                      '—'
                    )}
                  </TD>
                  <TD align="right" numeric>
                    {invoice.currency} {formatNumber(invoice.amount, 2)}
                  </TD>
                  <TD align="right" numeric>
                    {formatNumber(invoice.amountPaid, 2)}
                  </TD>
                  <TD align="right" numeric>
                    <span className={balance > 0 ? 'text-saipei-red-600' : undefined}>
                      {formatKes(balance)}
                    </span>
                  </TD>
                  <TD>
                    <StatusBadge status={invoice.status} />
                  </TD>
                </TR>
              )
            })
          )}
        </TBody>
      </Table>

      <Pagination
        page={page}
        pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        total={total}
      />
    </>
  )
}
