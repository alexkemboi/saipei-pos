import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { ImportOrderForm } from './import-order-form'

export const metadata: Metadata = { title: 'New import order' }
export const dynamic = 'force-dynamic'

export default async function NewImportOrderPage() {
  await requirePermission('imports.manage')

  const suppliers = await db.supplier.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, country: true, currency: true },
  })

  return (
    <>
      <PageHeader
        breadcrumb="Import & Clearing · Import orders"
        title="New import order"
        description="Step one of the flow: record the order placed with the supplier."
      />
      <ImportOrderForm suppliers={suppliers} />
    </>
  )
}
