import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDateTime, formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'
import { ApprovalActions } from './approval-actions'

export const metadata: Metadata = { title: 'Approvals' }
export const dynamic = 'force-dynamic'

export default async function PurchasingApprovalsPage() {
  await requirePermission('purchasing.approve')

  const [pending, decided] = await Promise.all([
    db.approval.findMany({
      where: { entity: 'PurchaseOrder', status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        entityId: true,
        reference: true,
        requestedBy: true,
        amount: true,
        createdAt: true,
      },
    }),
    db.approval.findMany({
      where: { entity: 'PurchaseOrder', status: { not: 'PENDING' } },
      orderBy: { decidedAt: 'desc' },
      take: 15,
      select: {
        id: true,
        reference: true,
        status: true,
        requestedBy: true,
        amount: true,
        notes: true,
        decidedAt: true,
        actor: { select: { fullName: true } },
      },
    }),
  ])

  // Pull the order lines so an approver can see what they are committing to.
  const orders = await db.purchaseOrder.findMany({
    where: { id: { in: pending.map((p) => p.entityId) } },
    select: {
      id: true,
      currency: true,
      total: true,
      expectedDate: true,
      supplier: { select: { name: true } },
      lines: { select: { description: true, quantity: true } },
    },
  })
  const orderById = new Map(orders.map((order) => [order.id, order]))

  const pendingValue = pending.reduce((sum, p) => sum + toNumber(p.amount), 0)

  return (
    <>
      <PageHeader
        breadcrumb="Purchasing"
        title="Approvals"
        description="Purchase orders waiting for a decision before they are committed."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Awaiting decision"
          value={formatNumber(pending.length)}
          sublabel="purchase orders submitted"
          tone="amber"
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Value awaiting approval"
          value={formatKes(pendingValue)}
          sublabel="commitment if all are approved"
          tone="dark"
        />
      </div>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader title="Pending approvals" description="Oldest request first." />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <THead>
              <TR>
                <TH>Reference</TH>
                <TH>Supplier</TH>
                <TH>Requested by</TH>
                <TH>Submitted</TH>
                <TH>Items</TH>
                <TH align="right">Value</TH>
                <TH>Decision</TH>
              </TR>
            </THead>
            <TBody>
              {pending.length === 0 ? (
                <EmptyRow colSpan={7} message="Nothing is waiting for approval." />
              ) : (
                pending.map((approval) => {
                  const order = orderById.get(approval.entityId)
                  return (
                    <TR key={approval.id}>
                      <TD>
                        <span className="tabular font-semibold text-saipei-dark-700">
                          {approval.reference ?? '—'}
                        </span>
                      </TD>
                      <TD>{order?.supplier.name ?? '—'}</TD>
                      <TD>{approval.requestedBy ?? '—'}</TD>
                      <TD>{formatDateTime(approval.createdAt)}</TD>
                      <TD>
                        {order ? (
                          <span className="text-saipei-gray-600">
                            {order.lines.length} line
                            {order.lines.length === 1 ? '' : 's'}
                            <span className="block text-xs text-saipei-gray-400">
                              {order.lines
                                .slice(0, 2)
                                .map((line) => line.description)
                                .join(', ')}
                              {order.lines.length > 2 ? '…' : ''}
                            </span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </TD>
                      <TD align="right" numeric>
                        {order ? (
                          <>
                            {order.currency} {formatNumber(order.total, 2)}
                            <span className="block text-xs text-saipei-gray-500">
                              {formatKes(toNumber(approval.amount))}
                            </span>
                          </>
                        ) : (
                          formatKes(toNumber(approval.amount))
                        )}
                      </TD>
                      <TD>
                        <ApprovalActions purchaseOrderId={approval.entityId} />
                      </TD>
                    </TR>
                  )
                })
              )}
            </TBody>
          </table>
        </div>
      </Card>

      <div className="mt-5">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Recent decisions" description="The last fifteen decisions." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Reference</TH>
                  <TH>Requested by</TH>
                  <TH>Decided by</TH>
                  <TH>When</TH>
                  <TH align="right">Value</TH>
                  <TH>Outcome</TH>
                </TR>
              </THead>
              <TBody>
                {decided.length === 0 ? (
                  <EmptyRow colSpan={6} message="No decisions recorded yet." />
                ) : (
                  decided.map((approval) => (
                    <TR key={approval.id}>
                      <TD>
                        <span className="tabular font-medium text-saipei-dark-700">
                          {approval.reference ?? '—'}
                        </span>
                        {approval.notes ? (
                          <span className="block text-xs text-saipei-gray-500">
                            {approval.notes}
                          </span>
                        ) : null}
                      </TD>
                      <TD>{approval.requestedBy ?? '—'}</TD>
                      <TD>{approval.actor?.fullName ?? '—'}</TD>
                      <TD>
                        {approval.decidedAt ? formatDateTime(approval.decidedAt) : '—'}
                      </TD>
                      <TD align="right" numeric>
                        {formatKes(toNumber(approval.amount))}
                      </TD>
                      <TD>
                        <StatusBadge status={approval.status} />
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}
