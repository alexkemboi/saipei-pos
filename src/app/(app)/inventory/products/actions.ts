'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { audit, requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { nextReference } from '@/lib/references'

export interface FormState {
  error?: string
  fieldErrors?: Record<string, string>
}

const schema = z.object({
  sku: z.string().trim().max(40).optional(),
  barcode: z.string().trim().max(60).optional(),
  name: z.string().trim().min(2, 'Enter the product name'),
  description: z.string().trim().max(500).optional(),
  categoryId: z.string().trim().optional(),
  unit: z.enum(['PIECE', 'PAIR', 'BALE', 'KG', 'CARTON', 'DOZEN']),
  costPrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  reorderLevel: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100),
  isActive: z.boolean(),
})

function parse(formData: FormData) {
  return schema.safeParse({
    sku: formData.get('sku') ?? undefined,
    barcode: formData.get('barcode') ?? undefined,
    name: formData.get('name'),
    description: formData.get('description') ?? undefined,
    categoryId: formData.get('categoryId') ?? undefined,
    unit: formData.get('unit'),
    costPrice: formData.get('costPrice') ?? 0,
    sellingPrice: formData.get('sellingPrice') ?? 0,
    reorderLevel: formData.get('reorderLevel') ?? 0,
    taxRate: formData.get('taxRate') ?? 0,
    isActive: formData.get('isActive') !== null,
  })
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '')
    if (key && !result[key]) result[key] = issue.message
  }
  return result
}

export async function createProduct(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePermission('products.manage')
  const parsed = parse(formData)
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }
  const data = parsed.data

  let id: string
  try {
    if (data.sku) {
      const clash = await db.product.findUnique({ where: { sku: data.sku } })
      if (clash) return { fieldErrors: { sku: 'That SKU is already in use.' } }
    }
    if (data.barcode) {
      const clash = await db.product.findFirst({ where: { barcode: data.barcode } })
      if (clash) return { fieldErrors: { barcode: 'That barcode is already in use.' } }
    }

    const product = await db.$transaction(async (tx) => {
      const sku = data.sku || (await nextReference(tx, 'product'))
      return tx.product.create({
        data: {
          sku,
          barcode: data.barcode || null,
          name: data.name,
          description: data.description || null,
          categoryId: data.categoryId || null,
          unit: data.unit,
          costPrice: data.costPrice,
          sellingPrice: data.sellingPrice,
          reorderLevel: data.reorderLevel,
          taxRate: data.taxRate,
          isActive: data.isActive,
        },
        select: { id: true, sku: true },
      })
    })
    id = product.id

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'Product',
      entityId: product.id,
      summary: `Product ${product.sku} — ${data.name} created`,
    })
  } catch (error) {
    console.error('createProduct failed', error)
    return { error: 'The product could not be saved. Please try again.' }
  }

  revalidatePath('/inventory/products')
  redirect(`/inventory/products/${id}`)
}

export async function updateProduct(
  productId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePermission('products.manage')
  const parsed = parse(formData)
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }
  const data = parsed.data

  try {
    if (data.sku) {
      const clash = await db.product.findFirst({
        where: { sku: data.sku, id: { not: productId } },
      })
      if (clash) return { fieldErrors: { sku: 'That SKU is already in use.' } }
    }
    if (data.barcode) {
      const clash = await db.product.findFirst({
        where: { barcode: data.barcode, id: { not: productId } },
      })
      if (clash) return { fieldErrors: { barcode: 'That barcode is already in use.' } }
    }

    await db.product.update({
      where: { id: productId },
      data: {
        ...(data.sku ? { sku: data.sku } : {}),
        barcode: data.barcode || null,
        name: data.name,
        description: data.description || null,
        categoryId: data.categoryId || null,
        unit: data.unit,
        costPrice: data.costPrice,
        sellingPrice: data.sellingPrice,
        reorderLevel: data.reorderLevel,
        taxRate: data.taxRate,
        isActive: data.isActive,
      },
    })

    await audit({
      userId: user.id,
      action: 'UPDATE',
      entity: 'Product',
      entityId: productId,
      summary: `Product ${data.name} updated`,
    })
  } catch (error) {
    console.error('updateProduct failed', error)
    return { error: 'The product could not be saved. Please try again.' }
  }

  revalidatePath('/inventory/products')
  redirect(`/inventory/products/${productId}`)
}
