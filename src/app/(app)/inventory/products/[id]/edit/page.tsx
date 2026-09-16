import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/page'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { toNumber } from '@/lib/utils'
import { ProductForm } from '../../product-form'
import { updateProduct } from '../../actions'

export const metadata: Metadata = { title: 'Edit product' }
export const dynamic = 'force-dynamic'

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('products.manage')
  const { id } = await params

  const [product, categories] = await Promise.all([
    db.product.findUnique({ where: { id } }),
    db.category.findMany({ orderBy: { name: 'asc' } }),
  ])
  if (!product) notFound()

  const action = updateProduct.bind(null, product.id)

  return (
    <>
      <PageHeader
        breadcrumb={`Warehousing & Inventory · Products · ${product.sku}`}
        title={`Edit ${product.name}`}
      />
      <ProductForm
        action={action}
        categories={categories}
        submitLabel="Save changes"
        values={{
          sku: product.sku,
          barcode: product.barcode ?? '',
          name: product.name,
          description: product.description ?? '',
          categoryId: product.categoryId ?? '',
          unit: product.unit,
          costPrice: toNumber(product.costPrice),
          sellingPrice: toNumber(product.sellingPrice),
          reorderLevel: toNumber(product.reorderLevel),
          taxRate: toNumber(product.taxRate),
          isActive: product.isActive,
        }}
      />
    </>
  )
}
