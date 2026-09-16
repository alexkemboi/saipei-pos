import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, Users, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ListFilters, Pagination } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatKes, formatNumber, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Customers' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requirePermission('customers.manage')
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const where: Record<string, unknown> = {}
  if (params.q) {
    where.OR = [
      { name: { contains: params.q } },
      { code: { contains: params.q } },
      { phone: { contains: params.q } },
    ]
  }
  if (params.standing === 'owing') where.balance = { gt: 0 }
  if (params.standing === 'clear') where.balance = { lte: 0 }

  const [rows, total, debt] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        email: true,
        balance: true,
        creditLimit: true,
        isActive: true,
        _count: { select: { sales: true } },
      },
    }),
    db.customer.count({ where }),
    db.customer.aggregate({ where: { balance: { gt: 0 } }, _sum: { balance: true } }),
  ])

  return (
    <>
      <PageHeader
        breadcrumb="Sales & POS"
        title="Customers"
        description="Accounts, credit limits and outstanding balances."
        action={
          <Link href="/sales/customers/new">
            <Button icon={<Plus className="h-4 w-4" aria-hidden />}>New customer</Button>
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Customers"
          value={formatNumber(total)}
          sublabel="matching the current filters"
          tone="dark"
          icon={<Users className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Total owed to SAIPEI"
          value={formatKes(toNumber(debt._sum.balance))}
          sublabel="across all customer accounts"
          tone="red"
          icon={<Wallet className="h-4 w-4" aria-hidden />}
        />
      </div>

      <ListFilters
        searchPlaceholder="Search by name, code or phone…"
        selects={[
          {
            name: 'standing',
            label: 'Standing',
            options: [
              { value: 'owing', label: 'Owing money' },
              { value: 'clear', label: 'Settled' },
            ],
          },
        ]}
      />

      <Table>
        <THead>
          <TR>
            <TH>Code</TH>
            <TH>Customer</TH>
            <TH>Phone</TH>
            <TH align="right">Sales</TH>
            <TH align="right">Credit limit</TH>
            <TH align="right">Balance</TH>
            <TH>Standing</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={7} message="No customers match these filters." />
          ) : (
            rows.map((customer) => {
              const balance = toNumber(customer.balance)
              const limit = toNumber(customer.creditLimit)
              const overLimit = limit > 0 && balance > limit

              return (
                <TR key={customer.id}>
                  <TD>
                    <span className="tabular text-saipei-gray-600">{customer.code}</span>
                  </TD>
                  <TD>
                    <Link
                      href={`/sales/customers/${customer.id}`}
                      className="font-semibold text-saipei-dark-700 hover:text-saipei-green-700 hover:underline"
                    >
                      {customer.name}
                    </Link>
                  </TD>
                  <TD>
                    <span className="tabular">{customer.phone ?? '—'}</span>
                  </TD>
                  <TD align="right" numeric>
                    {formatNumber(customer._count.sales)}
                  </TD>
                  <TD align="right" numeric>
                    {limit > 0 ? formatKes(limit) : '—'}
                  </TD>
                  <TD align="right" numeric>
                    <span className={balance > 0 ? 'text-saipei-red-600' : undefined}>
                      {formatKes(balance)}
                    </span>
                  </TD>
                  <TD>
                    {overLimit ? (
                      <Badge tone="danger">Over limit</Badge>
                    ) : balance > 0 ? (
                      <Badge tone="warning">Owing</Badge>
                    ) : (
                      <Badge tone="success">Settled</Badge>
                    )}
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
