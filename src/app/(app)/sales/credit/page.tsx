import type { Metadata } from 'next'
import Link from 'next/link'
import { CreditCard, Wallet } from 'lucide-react'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ListFilters, Pagination } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, formatKes, formatNumber, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Credit sales' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function CreditSalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requirePermission('sales.view')
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const where: Record<string, unknown> = {
    isCredit: true,
    status: { in: ['CREDIT', 'PARTIALLY_PAID'] },
  }
  if (params.q) {
    where.OR = [
      { reference: { contains: params.q } },
      { customer: { name: { contains: params.q } } },
    ]
  }

  const [rows, total, aggregate] = await Promise.all([
    db.sale.findMany({
      where,
      orderBy: { saleDate: 'asc' }, // oldest debt first - chase that one
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        saleDate: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        status: true,
        customer: { select: { id: true, name: true } },
      },
    }),
    db.sale.count({ where }),
    db.sale.aggregate({ where, _sum: { total: true, amountPaid: true } }),
  ])

  const outstanding =
    toNumber(aggregate._sum.total) - toNumber(aggregate._sum.amountPaid)
  const now = Date.now()

  return (
    <>
      <PageHeader
        breadcrumb="Sales & POS"
        title="Credit sales"
        description="Sales placed on customer accounts and not yet settled."
        action={
          <Link href="/sales/payments">
            <Button icon={<Wallet className="h-4 w-4" aria-hidden />}>Record a payment</Button>
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Outstanding on credit"
          value={formatKes(outstanding)}
          sublabel="still to be collected"
          tone="red"
          icon={<CreditCard className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Open credit sales"
          value={formatNumber(total)}
          sublabel="awaiting settlement"
          tone="amber"
        />
      </div>

      <ListFilters searchPlaceholder="Search by reference or customer…" />

      <Table>
        <THead>
          <TR>
            <TH>Reference</TH>
            <TH>Customer</TH>
            <TH>Sold</TH>
            <TH>Due</TH>
            <TH align="right">Total</TH>
            <TH align="right">Paid</TH>
            <TH align="right">Balance</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={8} message="No credit sales are outstanding." />
          ) : (
            rows.map((sale) => {
              const balance = toNumber(sale.total) - toNumber(sale.amountPaid)
              const overdue = sale.dueDate && sale.dueDate.getTime() < now

              return (
                <TR key={sale.id}>
                  <TD>
                    <Link
                      href={`/sales/${sale.id}`}
                      className="tabular font-semibold text-saipei-dark-700 hover:underline"
                    >
                      {sale.reference}
                    </Link>
                  </TD>
                  <TD>
                    {sale.customer ? (
                      <Link
                        href={`/sales/customers/${sale.customer.id}`}
                        className="hover:underline"
                      >
                        {sale.customer.name}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TD>
                  <TD>{formatDate(sale.saleDate)}</TD>
                  <TD>
                    {sale.dueDate ? (
                      overdue ? (
                        <Badge tone="danger">Overdue {formatDate(sale.dueDate)}</Badge>
                      ) : (
                        formatDate(sale.dueDate)
                      )
                    ) : (
                      '—'
                    )}
                  </TD>
                  <TD align="right" numeric>
                    {formatKes(sale.total)}
                  </TD>
                  <TD align="right" numeric>
                    {formatKes(sale.amountPaid)}
                  </TD>
                  <TD align="right" numeric>
                    <span className="text-saipei-red-600">{formatKes(balance)}</span>
                  </TD>
                  <TD>
                    <StatusBadge status={sale.status} />
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
