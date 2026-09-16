import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page'
import { requirePermission } from '@/lib/auth'
import { CustomerForm } from '../customer-form'
import { createCustomer } from '../actions'

export const metadata: Metadata = { title: 'New customer' }

export default async function NewCustomerPage() {
  await requirePermission('customers.manage')

  return (
    <>
      <PageHeader
        breadcrumb="Sales & POS · Customers"
        title="New customer"
        description="Customer codes are allocated automatically as CUS-YYYY-NNNN."
      />
      <CustomerForm action={createCustomer} submitLabel="Create customer" />
    </>
  )
}
