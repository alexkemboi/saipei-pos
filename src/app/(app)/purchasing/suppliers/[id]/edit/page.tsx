import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/page'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { SupplierForm } from '../../supplier-form'
import { updateSupplier } from '../../../actions'

export const metadata: Metadata = { title: 'Edit supplier' }
export const dynamic = 'force-dynamic'

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('suppliers.manage')
  const { id } = await params

  const supplier = await db.supplier.findUnique({ where: { id } })
  if (!supplier) notFound()

  const action = updateSupplier.bind(null, supplier.id)

  return (
    <>
      <PageHeader
        breadcrumb={`Purchasing · Suppliers · ${supplier.code}`}
        title={`Edit ${supplier.name}`}
      />
      <SupplierForm
        action={action}
        submitLabel="Save changes"
        values={{
          name: supplier.name,
          type: supplier.type,
          country: supplier.country ?? '',
          contactName: supplier.contactName ?? '',
          phone: supplier.phone ?? '',
          email: supplier.email ?? '',
          address: supplier.address ?? '',
          taxPin: supplier.taxPin ?? '',
          currency: supplier.currency,
          isActive: supplier.isActive,
        }}
      />
    </>
  )
}
