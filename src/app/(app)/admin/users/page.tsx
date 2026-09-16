import type { Metadata } from 'next'
import { ShieldCheck, UserCog } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDateTime, formatNumber } from '@/lib/utils'
import { UserAdmin } from './user-admin'

export const metadata: Metadata = { title: 'Users' }
export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  await requirePermission('admin.users')

  const [users, roles, branches] = await Promise.all([
    db.user.findMany({
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        roleId: true,
        branchId: true,
        role: { select: { name: true } },
        branch: { select: { name: true } },
      },
    }),
    db.role.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, _count: { select: { users: true } } },
    }),
    db.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  const active = users.filter((u) => u.isActive).length

  return (
    <>
      <PageHeader
        breadcrumb="Administration"
        title="Users"
        description="Who can sign in to SAIPEI POS, and what they are allowed to do."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Active users"
          value={formatNumber(active)}
          sublabel={`${formatNumber(users.length - active)} deactivated`}
          tone="green"
          icon={<UserCog className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Roles"
          value={formatNumber(roles.length)}
          sublabel="permission sets in use"
          tone="dark"
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Signed in recently"
          value={formatNumber(
            users.filter(
              (u) =>
                u.lastLoginAt &&
                Date.now() - u.lastLoginAt.getTime() < 7 * 24 * 60 * 60 * 1000,
            ).length,
          )}
          sublabel="in the last seven days"
          tone="dark"
        />
      </div>

      <div className="mb-6">
        <UserAdmin roles={roles} branches={branches} users={users} />
      </div>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader title="All users" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Username</TH>
                <TH>Email</TH>
                <TH>Role</TH>
                <TH>Branch</TH>
                <TH>Last signed in</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {users.length === 0 ? (
                <EmptyRow colSpan={7} message="No users yet." />
              ) : (
                users.map((user) => (
                  <TR key={user.id}>
                    <TD>
                      <span className="font-semibold text-saipei-dark-800">
                        {user.fullName}
                      </span>
                      {user.phone ? (
                        <span className="tabular block text-xs text-saipei-gray-500">
                          {user.phone}
                        </span>
                      ) : null}
                    </TD>
                    <TD>
                      <span className="tabular text-saipei-gray-600">{user.username}</span>
                    </TD>
                    <TD>{user.email}</TD>
                    <TD>
                      <Badge tone="info">{user.role.name}</Badge>
                    </TD>
                    <TD>{user.branch?.name ?? '—'}</TD>
                    <TD>
                      {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}
                    </TD>
                    <TD>
                      {user.isActive ? (
                        <Badge tone="success">Active</Badge>
                      ) : (
                        <Badge tone="neutral">Deactivated</Badge>
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
