import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/page'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { toNumber } from '@/lib/utils'
import { CustomerForm } from '../../customer-form'
import { updateCustomer } from '../../actions'

export const metadata: Metadata = { title: 'Edit customer' }
export const dynamic = 'force-dynamic'

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('customers.manage')
  const { id } = await params

  const customer = await db.customer.findUnique({ where: { id } })
  if (!customer) notFound()

  // Bind the id so the form action keeps the (state, formData) shape.
  const action = updateCustomer.bind(null, customer.id)

  return (
    <>
      <PageHeader
        breadcrumb={`Sales & POS · Customers · ${customer.code}`}
        title={`Edit ${customer.name}`}
      />
      <CustomerForm
        action={action}
        submitLabel="Save changes"
        values={{
          name: customer.name,
          phone: customer.phone ?? '',
          email: customer.email ?? '',
          address: customer.address ?? '',
          taxPin: customer.taxPin ?? '',
          creditLimit: toNumber(customer.creditLimit),
          isActive: customer.isActive,
        }}
      />
    </>
  )
}
