import type { Metadata } from 'next'
import Link from 'next/link'
import { Globe, Plus, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ListFilters, Pagination } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Suppliers' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requirePermission('suppliers.manage')
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const where: Record<string, unknown> = {}
  if (params.type) where.type = params.type
  if (params.active === 'yes') where.isActive = true
  if (params.active === 'no') where.isActive = false
  if (params.q) {
    where.OR = [
      { name: { contains: params.q } },
      { code: { contains: params.q } },
      { country: { contains: params.q } },
    ]
  }

  const [rows, total] = await Promise.all([
    db.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        country: true,
        contactName: true,
        phone: true,
        currency: true,
        isActive: true,
        _count: { select: { purchaseOrders: true, importOrders: true } },
        invoices: {
          where: { status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
          select: { amount: true, amountPaid: true, exchangeRate: true },
        },
      },
    }),
    db.supplier.count({ where }),
  ])

  const suppliers = rows.map((supplier) => ({
    ...supplier,
    payable: supplier.invoices.reduce(
      (sum, invoice) =>
        sum +
        (toNumber(invoice.amount) - toNumber(invoice.amountPaid)) *
          toNumber(invoice.exchangeRate),
      0,
    ),
  }))

  const totalPayable = suppliers.reduce((sum, s) => sum + s.payable, 0)
  const foreign = suppliers.filter((s) => s.type === 'FOREIGN').length

  return (
    <>
      <PageHeader
        breadcrumb="Purchasing"
        title="Suppliers"
        description="Who SAIPEI buys from, at home and abroad."
        action={
          <Link href="/purchasing/suppliers/new">
            <Button icon={<Plus className="h-4 w-4" aria-hidden />}>New supplier</Button>
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Suppliers"
          value={formatNumber(total)}
          sublabel="matching the current filters"
          tone="dark"
          icon={<Users className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Foreign suppliers"
          value={formatNumber(foreign)}
          sublabel="on this page"
          tone="dark"
          icon={<Globe className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Owed to suppliers"
          value={formatKes(totalPayable)}
          sublabel="unpaid invoices on this page"
          tone="red"
        />
      </div>

      <ListFilters
        searchPlaceholder="Search by name, code or country…"
        selects={[
          {
            name: 'type',
            label: 'Type',
            options: [
              { value: 'FOREIGN', label: 'Foreign' },
              { value: 'LOCAL', label: 'Local' },
            ],
          },
          {
            name: 'active',
            label: 'Status',
            options: [
              { value: 'yes', label: 'Active' },
              { value: 'no', label: 'Inactive' },
            ],
          },
        ]}
      />

      <Table>
        <THead>
          <TR>
            <TH>Code</TH>
            <TH>Supplier</TH>
            <TH>Type</TH>
            <TH>Country</TH>
            <TH>Contact</TH>
            <TH>Currency</TH>
            <TH align="right">Orders</TH>
            <TH align="right">Owed</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {suppliers.length === 0 ? (
            <EmptyRow colSpan={9} message="No suppliers match these filters." />
          ) : (
            suppliers.map((supplier) => (
              <TR key={supplier.id}>
                <TD>
                  <span className="tabular text-saipei-gray-600">{supplier.code}</span>
                </TD>
                <TD>
                  <Link
                    href={`/purchasing/suppliers/${supplier.id}`}
                    className="font-semibold text-saipei-dark-700 hover:text-saipei-green-700 hover:underline"
                  >
                    {supplier.name}
                  </Link>
                </TD>
                <TD>{humanize(supplier.type)}</TD>
                <TD>{supplier.country ?? '—'}</TD>
                <TD>
                  {supplier.contactName ?? '—'}
                  {supplier.phone ? (
                    <span className="tabular block text-xs text-saipei-gray-500">
                      {supplier.phone}
                    </span>
                  ) : null}
                </TD>
                <TD>
                  <span className="tabular">{supplier.currency}</span>
                </TD>
                <TD align="right" numeric>
                  {formatNumber(
                    supplier._count.purchaseOrders + supplier._count.importOrders,
                  )}
                </TD>
                <TD align="right" numeric>
                  <span className={supplier.payable > 0 ? 'text-saipei-red-600' : undefined}>
                    {formatKes(supplier.payable)}
                  </span>
                </TD>
                <TD>
                  {supplier.isActive ? (
                    <Badge tone="success">Active</Badge>
                  ) : (
                    <Badge tone="neutral">Inactive</Badge>
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
