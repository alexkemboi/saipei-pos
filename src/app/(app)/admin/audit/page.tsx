import type { Metadata } from 'next'
import { History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ListFilters, Pagination } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDateTime, formatNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Audit trail' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

/** Colour by what the action does, not by module. */
const ACTION_TONES: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
  VOID: 'danger',
  APPROVE: 'success',
  LOGIN: 'neutral',
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requirePermission('admin.audit')
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const where: Record<string, unknown> = {}
  if (params.action) where.action = params.action
  if (params.entity) where.entity = params.entity
  if (params.userId) where.userId = params.userId
  if (params.q) {
    where.OR = [
      { summary: { contains: params.q } },
      { entityId: { contains: params.q } },
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
    where.createdAt = range
  }

  const [rows, total, users, entities, todayCount] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        summary: true,
        createdAt: true,
        user: { select: { fullName: true, username: true } },
      },
    }),
    db.auditLog.count({ where }),
    db.user.findMany({
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true },
    }),
    db.auditLog.groupBy({ by: ['entity'], _count: { _all: true } }),
    db.auditLog.count({
      where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
  ])

  return (
    <>
      <PageHeader
        breadcrumb="Administration"
        title="Audit trail"
        description="Every change of consequence, who made it and when."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Entries shown"
          value={formatNumber(total)}
          sublabel="matching the current filters"
          tone="dark"
          icon={<History className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Activity today"
          value={formatNumber(todayCount)}
          sublabel="entries recorded since midnight"
          tone="green"
        />
        <StatCard
          label="Entities tracked"
          value={formatNumber(entities.length)}
          sublabel="different record types"
          tone="dark"
        />
      </div>

      <ListFilters
        searchPlaceholder="Search the summary or record id…"
        showDateRange
        selects={[
          {
            name: 'action',
            label: 'Action',
            options: [
              { value: 'CREATE', label: 'Create' },
              { value: 'UPDATE', label: 'Update' },
              { value: 'DELETE', label: 'Delete' },
              { value: 'APPROVE', label: 'Approve' },
              { value: 'VOID', label: 'Void' },
              { value: 'LOGIN', label: 'Sign in' },
            ],
          },
          {
            name: 'entity',
            label: 'Record type',
            options: entities
              .map((e) => ({ value: e.entity, label: e.entity }))
              .sort((a, b) => a.label.localeCompare(b.label)),
          },
          {
            name: 'userId',
            label: 'User',
            options: users.map((u) => ({ value: u.id, label: u.fullName })),
          },
        ]}
      />

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <THead>
              <TR>
                <TH>When</TH>
                <TH>User</TH>
                <TH>Action</TH>
                <TH>Record type</TH>
                <TH>Summary</TH>
              </TR>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={5} message="No audit entries match these filters." />
              ) : (
                rows.map((entry) => (
                  <TR key={entry.id}>
                    <TD>
                      <span className="tabular whitespace-nowrap">
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </TD>
                    <TD>
                      {entry.user ? (
                        <>
                          <span className="font-medium text-saipei-dark-800">
                            {entry.user.fullName}
                          </span>
                          <span className="tabular block text-xs text-saipei-gray-500">
                            {entry.user.username}
                          </span>
                        </>
                      ) : (
                        <span className="text-saipei-gray-400">System</span>
                      )}
                    </TD>
                    <TD>
                      <Badge tone={ACTION_TONES[entry.action] ?? 'neutral'}>
                        {entry.action}
                      </Badge>
                    </TD>
                    <TD>{entry.entity}</TD>
                    <TD>
                      <span className="text-saipei-gray-700">{entry.summary ?? '—'}</span>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </table>
        </div>
      </Card>

      <Pagination
        page={page}
        pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        total={total}
      />
    </>
  )
}
