import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { SettingsForm } from './settings-form'

export const metadata: Metadata = { title: 'System settings' }
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  await requirePermission('admin.settings')

  const [settings, branches, warehouses] = await Promise.all([
    db.setting.findMany(),
    db.branch.findMany({ orderBy: { name: 'asc' } }),
    db.warehouse.findMany({ orderBy: { name: 'asc' } }),
  ])

  const values = Object.fromEntries(settings.map((s) => [s.key, s.value]))

  return (
    <>
      <PageHeader
        breadcrumb="Administration"
        title="System settings"
        description="Company details, tax and how receipts are printed."
      />
      <SettingsForm
        values={values}
        branches={branches.map((b) => ({ id: b.id, name: b.name, code: b.code }))}
        warehouses={warehouses.map((w) => ({
          id: w.id,
          name: w.name,
          code: w.code,
          isDefault: w.isDefault,
        }))}
      />
    </>
  )
}
