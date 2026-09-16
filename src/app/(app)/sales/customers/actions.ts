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
  name: z.string().trim().min(2, 'Enter the customer name'),
  phone: z.string().trim().max(40).optional(),
  email: z.union([z.string().trim().email('Enter a valid email'), z.literal('')]).optional(),
  address: z.string().trim().max(300).optional(),
  taxPin: z.string().trim().max(40).optional(),
  creditLimit: z.coerce.number().min(0).default(0),
  isActive: z.boolean().default(true),
})

function parse(formData: FormData) {
  return schema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone') ?? undefined,
    email: formData.get('email') ?? undefined,
    address: formData.get('address') ?? undefined,
    taxPin: formData.get('taxPin') ?? undefined,
    creditLimit: formData.get('creditLimit') ?? 0,
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

export async function createCustomer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePermission('customers.manage')
  const parsed = parse(formData)
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }

  const data = parsed.data
  let id: string

  try {
    const customer = await db.$transaction(async (tx) => {
      const code = await nextReference(tx, 'customer')
      return tx.customer.create({
        data: {
          code,
          name: data.name,
          phone: data.phone || null,
          email: data.email || null,
          address: data.address || null,
          taxPin: data.taxPin || null,
          creditLimit: data.creditLimit,
          isActive: data.isActive,
        },
        select: { id: true, code: true },
      })
    })
    id = customer.id

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'Customer',
      entityId: customer.id,
      summary: `Customer ${customer.code} — ${data.name} created`,
    })
  } catch (error) {
    console.error('createCustomer failed', error)
    return { error: 'The customer could not be saved. Please try again.' }
  }

  revalidatePath('/sales/customers')
  redirect(`/sales/customers/${id}`)
}

export async function updateCustomer(
  customerId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePermission('customers.manage')
  const parsed = parse(formData)
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }

  const data = parsed.data

  try {
    await db.customer.update({
      where: { id: customerId },
      data: {
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        taxPin: data.taxPin || null,
        creditLimit: data.creditLimit,
        isActive: data.isActive,
      },
    })

    await audit({
      userId: user.id,
      action: 'UPDATE',
      entity: 'Customer',
      entityId: customerId,
      summary: `Customer ${data.name} updated`,
    })
  } catch (error) {
    console.error('updateCustomer failed', error)
    return { error: 'The customer could not be saved. Please try again.' }
  }

  revalidatePath('/sales/customers')
  redirect(`/sales/customers/${customerId}`)
}
