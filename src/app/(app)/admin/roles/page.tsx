import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'
import { PageHeader, StatCard } from '@/components/ui/page'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { formatNumber } from '@/lib/utils'
import { RoleEditor } from './role-editor'

export const metadata: Metadata = { title: 'Roles & permissions' }
export const dynamic = 'force-dynamic'

export default async function RolesPage() {
  await requirePermission('admin.roles')

  const roles = await db.role.findMany({
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      isSystem: true,
      permissions: { select: { permission: { select: { code: true } } } },
      _count: { select: { users: true } },
    },
  })

  // Group the catalogue by module so the editor reads like the sidebar.
  const modules = [...new Set(PERMISSIONS.map((p) => p.module))].map((module) => ({
    module,
    permissions: PERMISSIONS.filter((p) => p.module === module).map((p) => ({
      code: p.code,
      label: p.label,
    })),
  }))

  return (
    <>
      <PageHeader
        breadcrumb="Administration"
        title="Roles & permissions"
        description="What each role is allowed to see and do across the system."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Roles"
          value={formatNumber(roles.length)}
          sublabel={`${formatNumber(roles.filter((r) => r.isSystem).length)} built in`}
          tone="dark"
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Permissions"
          value={formatNumber(PERMISSIONS.length)}
          sublabel={`across ${formatNumber(modules.length)} modules`}
          tone="dark"
        />
        <StatCard
          label="Users assigned"
          value={formatNumber(roles.reduce((sum, r) => sum + r._count.users, 0))}
          sublabel="every user holds exactly one role"
          tone="green"
        />
      </div>

      <RoleEditor
        modules={modules}
        roles={roles.map((role) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
          userCount: role._count.users,
          permissionCodes: role.permissions.map((rp) => rp.permission.code),
        }))}
      />
    </>
  )
}
