import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page'
import { requirePermission } from '@/lib/auth'
import { SupplierForm } from '../supplier-form'
import { createSupplier } from '../../actions'

export const metadata: Metadata = { title: 'New supplier' }

export default async function NewSupplierPage() {
  await requirePermission('suppliers.manage')

  return (
    <>
      <PageHeader
        breadcrumb="Purchasing · Suppliers"
        title="New supplier"
        description="Supplier codes are allocated automatically as SUP-YYYY-NNNN."
      />
      <SupplierForm action={createSupplier} submitLabel="Create supplier" />
    </>
  )
}
