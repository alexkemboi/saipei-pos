import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { ListFilters } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDateTime, formatKes, formatNumber, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Approvals' }
export const dynamic = 'force-dynamic'

/** Where to send someone to action each kind of approval. */
const ACTION_ROUTES: Record<string, Route> = {
  PurchaseOrder: '/purchasing/approvals',
  Expense: '/finance/expenses',
  StockAdjustment: '/inventory/adjustments',
}

export default async function AdminApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requirePermission('admin.approvals')
  const params = await searchParams

  const where: Record<string, unknown> = {}
  if (params.status) where.status = params.status
  if (params.entity) where.entity = params.entity

  const [rows, pendingCount, pendingValue, entities] = await Promise.all([
    db.approval.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        entity: true,
        entityId: true,
        reference: true,
        status: true,
        requestedBy: true,
        amount: true,
        notes: true,
        createdAt: true,
        decidedAt: true,
        actor: { select: { fullName: true } },
      },
    }),
    db.approval.count({ where: { status: 'PENDING' } }),
    db.approval.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true } }),
    db.approval.groupBy({ by: ['entity'], _count: { _all: true } }),
  ])

  return (
    <>
      <PageHeader
        breadcrumb="Administration"
        title="Approvals"
        description="Everything across the system waiting for a decision, in one place."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Awaiting decision"
          value={formatNumber(pendingCount)}
          sublabel="across every module"
          tone={pendingCount > 0 ? 'amber' : 'green'}
          icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Value pending"
          value={formatKes(toNumber(pendingValue._sum.amount))}
          sublabel="commitment if all are approved"
          tone="dark"
        />
        <StatCard
          label="Record types"
          value={formatNumber(entities.length)}
          sublabel="raising approvals"
          tone="dark"
        />
      </div>

      <ListFilters
        showSearch={false}
        selects={[
          {
            name: 'status',
            label: 'Status',
            options: [
              { value: 'PENDING', label: 'Pending' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'REJECTED', label: 'Rejected' },
            ],
          },
          {
            name: 'entity',
            label: 'Record type',
            options: entities.map((e) => ({ value: e.entity, label: e.entity })),
          },
        ]}
      />

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Approval queue"
            description="Pending items first, then the most recent decisions."
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <THead>
              <TR>
                <TH>Reference</TH>
                <TH>Record type</TH>
                <TH>Requested by</TH>
                <TH>Raised</TH>
                <TH align="right">Value</TH>
                <TH>Decided by</TH>
                <TH>Status</TH>
                <TH>Action</TH>
              </TR>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={8} message="No approvals match these filters." />
              ) : (
                rows.map((approval) => (
                  <TR key={approval.id}>
                    <TD>
                      <span className="tabular font-semibold text-saipei-dark-700">
                        {approval.reference ?? '—'}
                      </span>
                      {approval.notes ? (
                        <span className="block text-xs text-saipei-gray-500">
                          {approval.notes}
                        </span>
                      ) : null}
                    </TD>
                    <TD>{approval.entity}</TD>
                    <TD>{approval.requestedBy ?? '—'}</TD>
                    <TD>{formatDateTime(approval.createdAt)}</TD>
                    <TD align="right" numeric>
                      {approval.amount !== null
                        ? formatKes(toNumber(approval.amount))
                        : '—'}
                    </TD>
                    <TD>
                      {approval.actor?.fullName ?? '—'}
                      {approval.decidedAt ? (
                        <span className="block text-xs text-saipei-gray-500">
                          {formatDateTime(approval.decidedAt)}
                        </span>
                      ) : null}
                    </TD>
                    <TD>
                      <StatusBadge status={approval.status} />
                    </TD>
                    <TD>
                      {approval.status === 'PENDING' &&
                      ACTION_ROUTES[approval.entity] ? (
                        <Link href={ACTION_ROUTES[approval.entity]}>
                          <Button variant="secondary" size="sm">
                            Review
                          </Button>
                        </Link>
                      ) : (
                        <span className="text-xs text-saipei-gray-400">—</span>
                      )}
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
