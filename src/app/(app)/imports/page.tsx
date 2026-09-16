import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, Ship } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { ListFilters, Pagination } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, formatKes, formatNumber, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Import orders' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

/** The pipeline in business order, matching the flow in the spec. */
const STAGES = [
  'ORDER_PLACED',
  'SUPPLIER_INVOICED',
  'DEPOSIT_PAID',
  'DOCUMENTATION',
  'LOADED',
  'IN_TRANSIT',
  'ARRIVED',
  'CLEARING',
  'RELEASED',
  'RECEIVED',
  'CLOSED',
]

export default async function ImportOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const user = await requirePermission('imports.view')
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const where: Record<string, unknown> = {}
  if (params.stage) where.stage = params.stage
  if (params.supplierId) where.supplierId = params.supplierId
  if (params.q) {
    where.OR = [
      { reference: { contains: params.q } },
      { description: { contains: params.q } },
      { supplier: { name: { contains: params.q } } },
    ]
  }

  const [rows, total, suppliers, pipeline] = await Promise.all([
    db.importOrder.findMany({
      where,
      orderBy: { orderDate: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        orderDate: true,
        stage: true,
        description: true,
        currency: true,
        exchangeRate: true,
        goodsValue: true,
        supplier: { select: { name: true } },
        shipments: { select: { id: true, status: true } },
        charges: { select: { amountKes: true } },
      },
    }),
    db.importOrder.count({ where }),
    db.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    db.importOrder.groupBy({ by: ['stage'], _count: { _all: true } }),
  ])

  const active = pipeline
    .filter((row) => row.stage !== 'CLOSED')
    .reduce((sum, row) => sum + row._count._all, 0)

  const goodsValueKes = rows.reduce(
    (sum, row) => sum + toNumber(row.goodsValue) * toNumber(row.exchangeRate),
    0,
  )
  const chargesKes = rows.reduce(
    (sum, row) => sum + row.charges.reduce((s, c) => s + toNumber(c.amountKes), 0),
    0,
  )

  return (
    <>
      <PageHeader
        breadcrumb="Import & Clearing"
        title="Import orders"
        description="Every consignment from the order in China to release from the port."
        action={
          user.permissions.includes('imports.manage') ? (
            <Link href="/imports/new">
              <Button icon={<Plus className="h-4 w-4" aria-hidden />}>New import order</Button>
            </Link>
          ) : null
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active imports"
          value={formatNumber(active)}
          sublabel="not yet closed"
          tone="dark"
          icon={<Ship className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Orders shown"
          value={formatNumber(total)}
          sublabel="matching the current filters"
          tone="dark"
        />
        <StatCard
          label="Goods value"
          value={formatKes(goodsValueKes)}
          sublabel="on this page, converted to KES"
          tone="green"
        />
        <StatCard
          label="Import charges"
          value={formatKes(chargesKes)}
          sublabel="freight, clearing, taxes on this page"
          tone="red"
        />
      </div>

      <div className="mb-5">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Pipeline"
              description="Where each consignment sits in the process right now."
            />
          </div>
          <div className="flex flex-wrap gap-2 px-5 pb-5">
            {STAGES.map((stage) => {
              const count = pipeline.find((row) => row.stage === stage)?._count._all ?? 0
              return (
                <Link
                  key={stage}
                  href={`/imports?stage=${stage}`}
                  className="flex items-center gap-2 rounded-md border border-saipei-gray-200 px-3 py-2 transition-colors hover:border-saipei-green-400 hover:bg-saipei-green-50"
                >
                  <StatusBadge status={stage} />
                  <span className="tabular text-sm font-semibold text-saipei-dark-800">
                    {count}
                  </span>
                </Link>
              )
            })}
          </div>
        </Card>
      </div>

      <ListFilters
        searchPlaceholder="Search by reference, description or supplier…"
        selects={[
          {
            name: 'stage',
            label: 'Stage',
            options: STAGES.map((stage) => ({
              value: stage,
              label: stage.replace(/_/g, ' ').toLowerCase(),
            })),
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
            <TH>Reference</TH>
            <TH>Supplier</TH>
            <TH>Ordered</TH>
            <TH>Description</TH>
            <TH align="right">Goods value</TH>
            <TH align="right">Charges (KES)</TH>
            <TH align="right">Shipments</TH>
            <TH>Stage</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={8} message="No import orders match these filters." />
          ) : (
            rows.map((order) => (
              <TR key={order.id}>
                <TD>
                  <Link
                    href={`/imports/${order.id}`}
                    className="tabular font-semibold text-saipei-dark-700 hover:text-saipei-green-700 hover:underline"
                  >
                    {order.reference}
                  </Link>
                </TD>
                <TD>{order.supplier.name}</TD>
                <TD>{formatDate(order.orderDate)}</TD>
                <TD>
                  <span className="text-saipei-gray-600">{order.description ?? '—'}</span>
                </TD>
                <TD align="right" numeric>
                  {order.currency} {formatNumber(order.goodsValue, 2)}
                </TD>
                <TD align="right" numeric>
                  {formatKes(
                    order.charges.reduce((sum, c) => sum + toNumber(c.amountKes), 0),
                  )}
                </TD>
                <TD align="right" numeric>
                  {formatNumber(order.shipments.length)}
                </TD>
                <TD>
                  <StatusBadge status={order.stage} />
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
