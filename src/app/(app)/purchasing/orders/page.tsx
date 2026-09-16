import type { Metadata } from 'next'
import { ClipboardList } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { ListFilters, Pagination } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, formatKes, formatNumber, toNumber } from '@/lib/utils'
import { PurchaseOrderForm } from './po-form'

export const metadata: Metadata = { title: 'Purchase orders' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function PurchaseOrdersPage({
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
      { reference: { contains: params.q } },
      { supplier: { name: { contains: params.q } } },
    ]
  }

  const [rows, total, suppliers, products, statusCounts] = await Promise.all([
    db.purchaseOrder.findMany({
      where,
      orderBy: { orderDate: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        orderDate: true,
        expectedDate: true,
        currency: true,
        exchangeRate: true,
        total: true,
        status: true,
        supplier: { select: { name: true } },
        _count: { select: { lines: true } },
      },
    }),
    db.purchaseOrder.count({ where }),
    db.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, currency: true },
    }),
    db.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, sku: true, name: true },
    }),
    db.purchaseOrder.groupBy({ by: ['status'], _count: { _all: true } }),
  ])

  const countOf = (status: string) =>
    statusCounts.find((row) => row.status === status)?._count._all ?? 0

  const pageValueKes = rows.reduce(
    (sum, row) => sum + toNumber(row.total) * toNumber(row.exchangeRate),
    0,
  )

  return (
    <>
      <PageHeader
        breadcrumb="Purchasing"
        title="Purchase orders"
        description="Orders placed with suppliers, with approval before they are committed."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Awaiting approval"
          value={formatNumber(countOf('PENDING_APPROVAL'))}
          sublabel="submitted, not yet decided"
          tone="amber"
          icon={<ClipboardList className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Approved"
          value={formatNumber(countOf('APPROVED'))}
          sublabel="committed to suppliers"
          tone="green"
        />
        <StatCard
          label="Drafts"
          value={formatNumber(countOf('DRAFT'))}
          sublabel="not yet submitted"
          tone="neutral"
        />
        <StatCard
          label="Value on this page"
          value={formatKes(pageValueKes)}
          sublabel="converted to shillings"
          tone="dark"
        />
      </div>

      {user.permissions.includes('purchasing.manage') ? (
        <div className="mb-6">
          <PurchaseOrderForm suppliers={suppliers} products={products} />
        </div>
      ) : null}

      <ListFilters
        searchPlaceholder="Search by reference or supplier…"
        selects={[
          {
            name: 'status',
            label: 'Status',
            options: [
              { value: 'DRAFT', label: 'Draft' },
              { value: 'PENDING_APPROVAL', label: 'Pending approval' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'PARTIALLY_RECEIVED', label: 'Partially received' },
              { value: 'RECEIVED', label: 'Received' },
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
            <TH>Reference</TH>
            <TH>Supplier</TH>
            <TH>Ordered</TH>
            <TH>Expected</TH>
            <TH align="right">Lines</TH>
            <TH align="right">Total</TH>
            <TH align="right">KES</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={8} message="No purchase orders match these filters." />
          ) : (
            rows.map((order) => (
              <TR key={order.id}>
                <TD>
                  <span className="tabular font-semibold text-saipei-dark-700">
                    {order.reference}
                  </span>
                </TD>
                <TD>{order.supplier.name}</TD>
                <TD>{formatDate(order.orderDate)}</TD>
                <TD>{order.expectedDate ? formatDate(order.expectedDate) : '—'}</TD>
                <TD align="right" numeric>
                  {formatNumber(order._count.lines)}
                </TD>
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
      </Table>

      <Pagination
        page={page}
        pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        total={total}
      />
    </>
  )
}
