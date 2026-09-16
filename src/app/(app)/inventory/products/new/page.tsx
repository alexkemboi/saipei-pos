import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { ProductForm } from '../product-form'
import { createProduct } from '../actions'

export const metadata: Metadata = { title: 'New product' }
export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
  await requirePermission('products.manage')
  const categories = await db.category.findMany({ orderBy: { name: 'asc' } })

  return (
    <>
      <PageHeader
        breadcrumb="Warehousing & Inventory · Products"
        title="New product"
        description="Add an item to the catalogue so it can be received and sold."
      />
      <ProductForm action={createProduct} categories={categories} submitLabel="Create product" />
    </>
  )
}
