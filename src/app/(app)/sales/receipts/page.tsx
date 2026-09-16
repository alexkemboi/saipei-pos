import type { Metadata } from 'next'
import Link from 'next/link'
import { Banknote, ScrollText } from 'lucide-react'
import { PaymentBadge } from '@/components/ui/badge'
import { ListFilters, Pagination } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDateTime, formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Receipts' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requirePermission('sales.view')
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const where: Record<string, unknown> = {}
  if (params.method) where.method = params.method
  if (params.status) where.status = params.status
  if (params.q) {
    where.OR = [
      { reference: { contains: params.q } },
      { mpesaCode: { contains: params.q } },
      { customer: { name: { contains: params.q } } },
    ]
  }
  if (params.from || params.to) {
    const range: Record<string, Date> = {}
    if (params.from) range.gte = new Date(params.from)
    if (params.to) {
      const to = new Date(params.to)
      to.setHours(23, 59, 59, 999)
      range.lte = to
    }
    where.receiptDate = range
  }

  const [rows, total, sum, byMethod] = await Promise.all([
    db.receipt.findMany({
      where,
      orderBy: { receiptDate: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        receiptDate: true,
        method: true,
        status: true,
        amount: true,
        mpesaCode: true,
        bankReference: true,
        customer: { select: { name: true } },
        sale: { select: { id: true, reference: true } },
        user: { select: { fullName: true } },
      },
    }),
    db.receipt.count({ where }),
    db.receipt.aggregate({ where, _sum: { amount: true } }),
    db.receipt.groupBy({ where, by: ['method'], _sum: { amount: true } }),
  ])

  const cash = toNumber(byMethod.find((m) => m.method === 'CASH')?._sum.amount)
  const mpesa = toNumber(byMethod.find((m) => m.method === 'MPESA')?._sum.amount)

  return (
    <>
      <PageHeader
        breadcrumb="Sales & POS"
        title="Receipts"
        description="Every shilling received, from the till and from customer accounts."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total received"
          value={formatKes(toNumber(sum._sum.amount))}
          sublabel="matching the current filters"
          tone="green"
          icon={<ScrollText className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Receipts"
          value={formatNumber(total)}
          sublabel="matching the current filters"
          tone="dark"
        />
        <StatCard
          label="Cash"
          value={formatKes(cash)}
          sublabel="collected in notes and coins"
          tone="dark"
          icon={<Banknote className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="M-PESA"
          value={formatKes(mpesa)}
          sublabel="Buy Goods 5606927"
          tone="green"
        />
      </div>

      <ListFilters
        searchPlaceholder="Search by reference, M-PESA code or customer…"
        showDateRange
        selects={[
          {
            name: 'method',
            label: 'Method',
            options: [
              { value: 'CASH', label: 'Cash' },
              { value: 'MPESA', label: 'M-PESA' },
              { value: 'BANK_TRANSFER', label: 'Bank transfer' },
              { value: 'CHEQUE', label: 'Cheque' },
              { value: 'CARD', label: 'Card' },
            ],
          },
          {
            name: 'status',
            label: 'Status',
            options: [
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'FAILED', label: 'Failed' },
              { value: 'REVERSED', label: 'Reversed' },
            ],
          },
        ]}
      />

      <Table>
        <THead>
          <TR>
            <TH>Receipt</TH>
            <TH>Date</TH>
            <TH>Customer</TH>
            <TH>Against sale</TH>
            <TH>Method</TH>
            <TH>Received by</TH>
            <TH align="right">Amount</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={8} message="No receipts match these filters." />
          ) : (
            rows.map((receipt) => (
              <TR key={receipt.id}>
                <TD>
                  <span className="tabular font-semibold text-saipei-dark-700">
                    {receipt.reference}
                  </span>
                </TD>
                <TD>{formatDateTime(receipt.receiptDate)}</TD>
                <TD>{receipt.customer?.name ?? 'Walk-in customer'}</TD>
                <TD>
                  {receipt.sale ? (
                    <Link
                      href={`/sales/${receipt.sale.id}`}
                      className="tabular text-saipei-dark-700 hover:underline"
                    >
                      {receipt.sale.reference}
                    </Link>
                  ) : (
                    <span className="text-saipei-gray-400">On account</span>
                  )}
                </TD>
                <TD>
                  {humanize(receipt.method)}
                  {receipt.mpesaCode || receipt.bankReference ? (
                    <span className="tabular block text-xs text-saipei-gray-500">
                      {receipt.mpesaCode ?? receipt.bankReference}
                    </span>
                  ) : null}
                </TD>
                <TD>{receipt.user?.fullName ?? '—'}</TD>
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
      </Table>

      <Pagination
        page={page}
        pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        total={total}
      />
    </>
  )
}
