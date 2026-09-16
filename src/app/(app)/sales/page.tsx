import type { Metadata } from 'next'
import Link from 'next/link'
import { Receipt, ShoppingCart } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ListFilters, Pagination } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDateTime, formatKes, formatNumber, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Sales' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requirePermission('sales.view')
  const params = await searchParams

  const page = Math.max(1, Number(params.page) || 1)
  const where = buildWhere(params)

  const [rows, total, totals] = await Promise.all([
    db.sale.findMany({
      where,
      orderBy: { saleDate: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        saleDate: true,
        total: true,
        amountPaid: true,
        status: true,
        channel: true,
        customer: { select: { name: true } },
        cashier: { select: { fullName: true } },
        _count: { select: { lines: true } },
      },
    }),
    db.sale.count({ where }),
    db.sale.aggregate({ where, _sum: { total: true, costOfSale: true } }),
  ])

  const revenue = toNumber(totals._sum.total)
  const cost = toNumber(totals._sum.costOfSale)

  return (
    <>
      <PageHeader
        breadcrumb="Sales & POS"
        title="Sales"
        description="Every transaction recorded at the till or raised as an order."
        action={
          <Link href="/pos">
            <Button variant="danger" icon={<ShoppingCart className="h-4 w-4" aria-hidden />}>
              Open POS
            </Button>
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Sales value"
          value={formatKes(revenue)}
          sublabel="matching the current filters"
          tone="green"
          icon={<Receipt className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Transactions"
          value={formatNumber(total)}
          sublabel="matching the current filters"
          tone="dark"
        />
        <StatCard
          label="Gross profit"
          value={formatKes(revenue - cost)}
          sublabel={revenue > 0 ? `${(((revenue - cost) / revenue) * 100).toFixed(1)}% margin` : 'no sales yet'}
          tone="green"
        />
      </div>

      <ListFilters
        searchPlaceholder="Search by receipt reference or customer…"
        showDateRange
        selects={[
          {
            name: 'status',
            label: 'Status',
            options: [
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'CREDIT', label: 'Credit' },
              { value: 'PARTIALLY_PAID', label: 'Partially paid' },
              { value: 'VOIDED', label: 'Voided' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ],
          },
          {
            name: 'channel',
            label: 'Channel',
            options: [
              { value: 'POS', label: 'POS' },
              { value: 'ORDER', label: 'Order' },
              { value: 'WHOLESALE', label: 'Wholesale' },
            ],
          },
        ]}
      />

      <Table>
        <THead>
          <TR>
            <TH>Reference</TH>
            <TH>Date</TH>
            <TH>Customer</TH>
            <TH>Cashier</TH>
            <TH align="right">Items</TH>
            <TH align="right">Total</TH>
            <TH align="right">Paid</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={8} message="No sales match these filters." />
          ) : (
            rows.map((sale) => (
              <TR key={sale.id}>
                <TD>
                  <Link
                    href={`/sales/${sale.id}`}
                    className="tabular font-semibold text-saipei-dark-700 hover:text-saipei-green-700 hover:underline"
                  >
                    {sale.reference}
                  </Link>
                </TD>
                <TD>{formatDateTime(sale.saleDate)}</TD>
                <TD>{sale.customer?.name ?? 'Walk-in customer'}</TD>
                <TD>{sale.cashier.fullName}</TD>
                <TD align="right" numeric>
                  {formatNumber(sale._count.lines)}
                </TD>
                <TD align="right" numeric>
                  {formatKes(sale.total)}
                </TD>
                <TD align="right" numeric>
                  {formatKes(sale.amountPaid)}
                </TD>
                <TD>
                  <StatusBadge status={sale.status} />
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

function buildWhere(params: Record<string, string | undefined>) {
  const where: Record<string, unknown> = {}

  if (params.status) where.status = params.status
  if (params.channel) where.channel = params.channel

  if (params.from || params.to) {
    const range: Record<string, Date> = {}
    if (params.from) range.gte = new Date(params.from)
    if (params.to) {
      // An inclusive end date means up to the last moment of that day.
      const to = new Date(params.to)
      to.setHours(23, 59, 59, 999)
      range.lte = to
    }
    where.saleDate = range
  }

  if (params.q) {
    where.OR = [
      { reference: { contains: params.q } },
      { customer: { name: { contains: params.q } } },
    ]
  }

  return where
}
