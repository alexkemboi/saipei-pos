import type { Metadata } from 'next'
import { Banknote, PiggyBank } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { ListFilters, Pagination } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'
import { SupplierPaymentForm, type PayableInvoice } from './payment-form'

export const metadata: Metadata = { title: 'Supplier payments' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function SupplierPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const user = await requirePermission('purchasing.view')
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const where: Record<string, unknown> = { payeeType: 'SUPPLIER' }
  if (params.supplierId) where.supplierId = params.supplierId
  if (params.method) where.method = params.method
  if (params.kind === 'deposit') where.isDeposit = true
  if (params.kind === 'settlement') where.isDeposit = false

  const [rows, total, sum, suppliers, openInvoices, deposits] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        paymentDate: true,
        method: true,
        currency: true,
        amount: true,
        amountKes: true,
        isDeposit: true,
        bankReference: true,
        mpesaCode: true,
        supplier: { select: { name: true } },
        supplierInvoice: { select: { invoiceNumber: true } },
        user: { select: { fullName: true } },
      },
    }),
    db.payment.count({ where }),
    db.payment.aggregate({ where, _sum: { amountKes: true } }),
    db.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, currency: true },
    }),
    db.supplierInvoice.findMany({
      where: { status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
      orderBy: { invoiceDate: 'asc' },
      select: {
        id: true,
        supplierId: true,
        invoiceNumber: true,
        amount: true,
        amountPaid: true,
        currency: true,
        exchangeRate: true,
      },
    }),
    db.payment.aggregate({
      where: { payeeType: 'SUPPLIER', isDeposit: true },
      _sum: { amountKes: true },
    }),
  ])

  const payable: PayableInvoice[] = openInvoices.map((invoice) => ({
    id: invoice.id,
    supplierId: invoice.supplierId,
    label: invoice.invoiceNumber,
    balance:
      Math.round((toNumber(invoice.amount) - toNumber(invoice.amountPaid)) * 100) / 100,
    currency: invoice.currency,
    exchangeRate: toNumber(invoice.exchangeRate),
  }))

  return (
    <>
      <PageHeader
        breadcrumb="Purchasing"
        title="Supplier payments"
        description="Deposits and settlements paid out to suppliers."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Paid out"
          value={formatKes(toNumber(sum._sum.amountKes))}
          sublabel="matching the current filters"
          tone="red"
          icon={<Banknote className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Payments"
          value={formatNumber(total)}
          sublabel="matching the current filters"
          tone="dark"
        />
        <StatCard
          label="Deposits paid"
          value={formatKes(toNumber(deposits._sum.amountKes))}
          sublabel="advances against orders"
          tone="amber"
          icon={<PiggyBank className="h-4 w-4" aria-hidden />}
        />
      </div>

      {user.permissions.includes('finance.payments') ? (
        <div className="mb-6">
          <SupplierPaymentForm suppliers={suppliers} invoices={payable} />
        </div>
      ) : null}

      <ListFilters
        showSearch={false}
        selects={[
          {
            name: 'supplierId',
            label: 'Supplier',
            options: suppliers.map((s) => ({ value: s.id, label: s.name })),
          },
          {
            name: 'method',
            label: 'Method',
            options: [
              { value: 'BANK_TRANSFER', label: 'Bank transfer' },
              { value: 'MPESA', label: 'M-PESA' },
              { value: 'CHEQUE', label: 'Cheque' },
              { value: 'CASH', label: 'Cash' },
            ],
          },
          {
            name: 'kind',
            label: 'Type',
            options: [
              { value: 'deposit', label: 'Deposits' },
              { value: 'settlement', label: 'Settlements' },
            ],
          },
        ]}
      />

      <Table>
        <THead>
          <TR>
            <TH>Reference</TH>
            <TH>Supplier</TH>
            <TH>Against invoice</TH>
            <TH>Date</TH>
            <TH>Method</TH>
            <TH>By</TH>
            <TH align="right">Amount</TH>
            <TH align="right">KES</TH>
            <TH>Type</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={9} message="No payments match these filters." />
          ) : (
            rows.map((payment) => (
              <TR key={payment.id}>
                <TD>
                  <span className="tabular font-semibold text-saipei-dark-700">
                    {payment.reference}
                  </span>
                </TD>
                <TD>{payment.supplier?.name ?? '—'}</TD>
                <TD>
                  <span className="tabular text-saipei-gray-600">
                    {payment.supplierInvoice?.invoiceNumber ?? '—'}
                  </span>
                </TD>
                <TD>{formatDate(payment.paymentDate)}</TD>
                <TD>
                  {humanize(payment.method)}
                  {payment.mpesaCode || payment.bankReference ? (
                    <span className="tabular block text-xs text-saipei-gray-500">
                      {payment.mpesaCode ?? payment.bankReference}
                    </span>
                  ) : null}
                </TD>
                <TD>{payment.user?.fullName ?? '—'}</TD>
                <TD align="right" numeric>
                  {payment.currency} {formatNumber(payment.amount, 2)}
                </TD>
                <TD align="right" numeric>
                  {formatKes(payment.amountKes)}
                </TD>
                <TD>
                  {payment.isDeposit ? (
                    <Badge tone="warning">Deposit</Badge>
                  ) : (
                    <Badge tone="success">Settlement</Badge>
                  )}
                </TD>
              </TR>
            ))
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
