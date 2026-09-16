'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { audit, requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { nextReference } from '@/lib/references'
import { toNumber } from '@/lib/utils'

export interface FormState {
  error?: string
  success?: string
  fieldErrors?: Record<string, string>
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '')
    if (key && !result[key]) result[key] = issue.message
  }
  return result
}

const round2 = (n: number) => Math.round(n * 100) / 100

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

const supplierSchema = z.object({
  name: z.string().trim().min(2, 'Enter the supplier name'),
  type: z.enum(['LOCAL', 'FOREIGN']),
  country: z.string().trim().max(80).optional(),
  contactName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.union([z.string().trim().email('Enter a valid email'), z.literal('')]).optional(),
  address: z.string().trim().max(300).optional(),
  taxPin: z.string().trim().max(40).optional(),
  currency: z.string().trim().length(3),
  isActive: z.boolean(),
})

function parseSupplier(formData: FormData) {
  return supplierSchema.safeParse({
    name: formData.get('name'),
    type: formData.get('type') ?? 'FOREIGN',
    country: formData.get('country') ?? undefined,
    contactName: formData.get('contactName') ?? undefined,
    phone: formData.get('phone') ?? undefined,
    email: formData.get('email') ?? undefined,
    address: formData.get('address') ?? undefined,
    taxPin: formData.get('taxPin') ?? undefined,
    currency: formData.get('currency') ?? 'USD',
    isActive: formData.get('isActive') !== null,
  })
}

export async function createSupplier(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePermission('suppliers.manage')
  const parsed = parseSupplier(formData)
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }
  const data = parsed.data

  let id: string
  try {
    const supplier = await db.$transaction(async (tx) => {
      const code = await nextReference(tx, 'supplier')
      return tx.supplier.create({
        data: {
          code,
          name: data.name,
          type: data.type,
          country: data.country || null,
          contactName: data.contactName || null,
          phone: data.phone || null,
          email: data.email || null,
          address: data.address || null,
          taxPin: data.taxPin || null,
          currency: data.currency.toUpperCase(),
          isActive: data.isActive,
        },
        select: { id: true, code: true },
      })
    })
    id = supplier.id

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'Supplier',
      entityId: supplier.id,
      summary: `Supplier ${supplier.code} — ${data.name} created`,
    })
  } catch (error) {
    console.error('createSupplier failed', error)
    return { error: 'The supplier could not be saved. Please try again.' }
  }

  revalidatePath('/purchasing/suppliers')
  redirect(`/purchasing/suppliers/${id}`)
}

export async function updateSupplier(
  supplierId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePermission('suppliers.manage')
  const parsed = parseSupplier(formData)
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }
  const data = parsed.data

  try {
    await db.supplier.update({
      where: { id: supplierId },
      data: {
        name: data.name,
        type: data.type,
        country: data.country || null,
        contactName: data.contactName || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        taxPin: data.taxPin || null,
        currency: data.currency.toUpperCase(),
        isActive: data.isActive,
      },
    })

    await audit({
      userId: user.id,
      action: 'UPDATE',
      entity: 'Supplier',
      entityId: supplierId,
      summary: `Supplier ${data.name} updated`,
    })
  } catch (error) {
    console.error('updateSupplier failed', error)
    return { error: 'The supplier could not be saved. Please try again.' }
  }

  revalidatePath('/purchasing/suppliers')
  redirect(`/purchasing/suppliers/${supplierId}`)
}

// ---------------------------------------------------------------------------
// Purchase orders
// ---------------------------------------------------------------------------

const poSchema = z.object({
  supplierId: z.string().min(1, 'Choose the supplier'),
  orderDate: z.string().trim().optional(),
  expectedDate: z.string().trim().optional(),
  currency: z.string().trim().length(3),
  exchangeRate: z.number().positive(),
  notes: z.string().trim().max(600).optional(),
  submitForApproval: z.boolean().default(false),
  lines: z
    .array(
      z.object({
        productId: z.string().trim().optional(),
        description: z.string().trim().min(1, 'Describe the item'),
        quantity: z.number().positive(),
        unitPrice: z.number().min(0),
      }),
    )
    .min(1, 'Add at least one line'),
})

export type PurchaseOrderInput = z.input<typeof poSchema>

export async function createPurchaseOrder(
  input: PurchaseOrderInput,
): Promise<FormState & { id?: string }> {
  const user = await requirePermission('purchasing.manage')

  const parsed = poSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the order details.' }
  }
  const data = parsed.data

  const lines = data.lines.map((line) => ({
    productId: line.productId || null,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: round2(line.quantity * line.unitPrice),
  }))
  const subtotal = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0))

  try {
    const order = await db.$transaction(async (tx) => {
      const reference = await nextReference(tx, 'purchaseOrder')
      const created = await tx.purchaseOrder.create({
        data: {
          reference,
          supplierId: data.supplierId,
          orderDate: data.orderDate ? new Date(data.orderDate) : new Date(),
          expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
          currency: data.currency.toUpperCase(),
          exchangeRate: data.exchangeRate,
          subtotal,
          taxAmount: 0,
          total: subtotal,
          status: data.submitForApproval ? 'PENDING_APPROVAL' : 'DRAFT',
          notes: data.notes || null,
          lines: { create: lines },
        },
        select: { id: true, reference: true },
      })

      if (data.submitForApproval) {
        await tx.approval.create({
          data: {
            entity: 'PurchaseOrder',
            entityId: created.id,
            reference: created.reference,
            status: 'PENDING',
            requestedBy: user.fullName,
            amount: subtotal * data.exchangeRate,
          },
        })
      }

      return created
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'PurchaseOrder',
      entityId: order.id,
      summary: `Purchase order ${order.reference} raised`,
    })

    revalidatePath('/purchasing/orders')
    revalidatePath('/purchasing/approvals')

    return { success: `Purchase order ${order.reference} created.`, id: order.id }
  } catch (error) {
    console.error('createPurchaseOrder failed', error)
    return { error: 'The purchase order could not be saved. Please try again.' }
  }
}

export async function decidePurchaseOrder(input: {
  purchaseOrderId: string
  approve: boolean
  notes?: string
}): Promise<FormState> {
  const user = await requirePermission('purchasing.approve')

  try {
    const order = await db.$transaction(async (tx) => {
      const updated = await tx.purchaseOrder.update({
        where: { id: input.purchaseOrderId },
        data: { status: input.approve ? 'APPROVED' : 'CANCELLED' },
        select: { reference: true },
      })

      await tx.approval.updateMany({
        where: {
          entity: 'PurchaseOrder',
          entityId: input.purchaseOrderId,
          status: 'PENDING',
        },
        data: {
          status: input.approve ? 'APPROVED' : 'REJECTED',
          actorId: user.id,
          notes: input.notes ?? null,
          decidedAt: new Date(),
        },
      })

      return updated
    })

    await audit({
      userId: user.id,
      action: 'APPROVE',
      entity: 'PurchaseOrder',
      entityId: input.purchaseOrderId,
      summary: `Purchase order ${order.reference} ${input.approve ? 'approved' : 'rejected'}`,
    })
  } catch (error) {
    console.error('decidePurchaseOrder failed', error)
    return { error: 'The decision could not be saved.' }
  }

  revalidatePath('/purchasing/orders')
  revalidatePath('/purchasing/approvals')
  revalidatePath('/admin/approvals')
  return { success: input.approve ? 'Purchase order approved.' : 'Purchase order rejected.' }
}

// ---------------------------------------------------------------------------
// Supplier invoices
// ---------------------------------------------------------------------------

const invoiceSchema = z.object({
  supplierId: z.string().min(1, 'Choose the supplier'),
  purchaseOrderId: z.string().trim().optional(),
  invoiceNumber: z.string().trim().min(1, 'Enter the invoice number'),
  invoiceDate: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
  currency: z.string().trim().length(3),
  exchangeRate: z.coerce.number().positive(),
  amount: z.coerce.number().positive('Enter the invoice amount'),
  isFinal: z.boolean().default(false),
  notes: z.string().trim().max(600).optional(),
})

export async function createSupplierInvoice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePermission('purchasing.manage')

  const parsed = invoiceSchema.safeParse({
    supplierId: formData.get('supplierId'),
    purchaseOrderId: formData.get('purchaseOrderId') ?? undefined,
    invoiceNumber: formData.get('invoiceNumber'),
    invoiceDate: formData.get('invoiceDate') ?? undefined,
    dueDate: formData.get('dueDate') ?? undefined,
    currency: formData.get('currency') ?? 'USD',
    exchangeRate: formData.get('exchangeRate') ?? 1,
    amount: formData.get('amount') ?? 0,
    isFinal: formData.get('isFinal') !== null,
    notes: formData.get('notes') ?? undefined,
  })
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }
  const data = parsed.data

  try {
    const clash = await db.supplierInvoice.findFirst({
      where: { supplierId: data.supplierId, invoiceNumber: data.invoiceNumber },
    })
    if (clash) {
      return {
        fieldErrors: {
          invoiceNumber: 'That invoice number is already recorded for this supplier.',
        },
      }
    }

    await db.supplierInvoice.create({
      data: {
        invoiceNumber: data.invoiceNumber,
        supplierId: data.supplierId,
        purchaseOrderId: data.purchaseOrderId || null,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        currency: data.currency.toUpperCase(),
        exchangeRate: data.exchangeRate,
        amount: data.amount,
        isFinal: data.isFinal,
        status: 'UNPAID',
        notes: data.notes || null,
      },
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'SupplierInvoice',
      summary: `Supplier invoice ${data.invoiceNumber} for ${data.amount} ${data.currency}`,
    })
  } catch (error) {
    console.error('createSupplierInvoice failed', error)
    return { error: 'The invoice could not be saved. Please try again.' }
  }

  revalidatePath('/purchasing/invoices')
  return { success: `Invoice ${data.invoiceNumber} captured.` }
}

// ---------------------------------------------------------------------------
// Supplier payments and deposits
// ---------------------------------------------------------------------------

const paymentSchema = z.object({
  supplierId: z.string().min(1, 'Choose the supplier'),
  supplierInvoiceId: z.string().trim().optional(),
  method: z.enum(['CASH', 'MPESA', 'BANK_TRANSFER', 'CHEQUE', 'CARD']),
  isDeposit: z.boolean().default(false),
  currency: z.string().trim().length(3),
  exchangeRate: z.coerce.number().positive(),
  amount: z.coerce.number().positive('Enter the amount paid'),
  paymentDate: z.string().trim().optional(),
  bankReference: z.string().trim().max(80).optional(),
  mpesaCode: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(400).optional(),
})

export async function createSupplierPayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePermission('finance.payments')

  const parsed = paymentSchema.safeParse({
    supplierId: formData.get('supplierId'),
    supplierInvoiceId: formData.get('supplierInvoiceId') ?? undefined,
    method: formData.get('method') ?? 'BANK_TRANSFER',
    isDeposit: formData.get('isDeposit') !== null,
    currency: formData.get('currency') ?? 'USD',
    exchangeRate: formData.get('exchangeRate') ?? 1,
    amount: formData.get('amount') ?? 0,
    paymentDate: formData.get('paymentDate') ?? undefined,
    bankReference: formData.get('bankReference') ?? undefined,
    mpesaCode: formData.get('mpesaCode') ?? undefined,
    notes: formData.get('notes') ?? undefined,
  })
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }
  const data = parsed.data

  try {
    const reference = await db.$transaction(async (tx) => {
      const ref = await nextReference(tx, 'payment')

      await tx.payment.create({
        data: {
          reference: ref,
          payeeType: 'SUPPLIER',
          supplierId: data.supplierId,
          supplierInvoiceId: data.supplierInvoiceId || null,
          method: data.method,
          status: 'COMPLETED',
          isDeposit: data.isDeposit,
          currency: data.currency.toUpperCase(),
          exchangeRate: data.exchangeRate,
          amount: data.amount,
          amountKes: round2(data.amount * data.exchangeRate),
          paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
          bankReference: data.bankReference || null,
          mpesaCode: data.mpesaCode || null,
          notes: data.notes || null,
          userId: user.id,
        },
      })

      // Applying a payment settles the invoice it was made against.
      if (data.supplierInvoiceId) {
        const invoice = await tx.supplierInvoice.findUnique({
          where: { id: data.supplierInvoiceId },
          select: { amount: true, amountPaid: true },
        })
        if (invoice) {
          const paid = round2(toNumber(invoice.amountPaid) + data.amount)
          const total = toNumber(invoice.amount)
          await tx.supplierInvoice.update({
            where: { id: data.supplierInvoiceId },
            data: {
              amountPaid: paid,
              status: paid >= total ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
            },
          })
        }
      }

      return ref
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'Payment',
      summary: `Supplier payment ${reference} of ${data.amount} ${data.currency}`,
    })

    revalidatePath('/purchasing/payments')
    revalidatePath('/purchasing/invoices')
    revalidatePath('/finance/supplier-payments')

    return { success: `Payment ${reference} recorded.` }
  } catch (error) {
    console.error('createSupplierPayment failed', error)
    return { error: 'The payment could not be saved. Please try again.' }
  }
}

// ---------------------------------------------------------------------------
// Purchase returns
// ---------------------------------------------------------------------------

const returnSchema = z.object({
  supplierId: z.string().min(1, 'Choose the supplier'),
  warehouseId: z.string().min(1, 'Choose the warehouse the goods leave from'),
  reason: z.string().trim().max(400).optional(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().positive(),
        unitPrice: z.number().min(0),
      }),
    )
    .min(1, 'Add at least one item'),
})

export type PurchaseReturnInput = z.input<typeof returnSchema>

export async function createPurchaseReturn(
  input: PurchaseReturnInput,
): Promise<FormState> {
  const user = await requirePermission('purchasing.manage')

  const parsed = returnSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the return details.' }
  }
  const data = parsed.data

  try {
    const reference = await db.$transaction(async (tx) => {
      const ref = await nextReference(tx, 'purchaseReturn')
      const lines = data.lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: round2(line.quantity * line.unitPrice),
      }))

      const created = await tx.purchaseReturn.create({
        data: {
          reference: ref,
          supplierId: data.supplierId,
          reason: data.reason || null,
          totalAmount: round2(lines.reduce((sum, l) => sum + l.lineTotal, 0)),
          lines: { create: lines },
        },
        select: { id: true },
      })

      // Goods going back to the supplier leave our stock.
      for (const line of lines) {
        const level = await tx.stockLevel.findUnique({
          where: {
            productId_warehouseId: {
              productId: line.productId,
              warehouseId: data.warehouseId,
            },
          },
        })
        const current = toNumber(level?.quantity)
        if (current < line.quantity) {
          const product = await tx.product.findUnique({
            where: { id: line.productId },
            select: { name: true },
          })
          throw new PurchaseError(
            `Only ${current} of ${product?.name ?? 'that product'} is in stock.`,
          )
        }

        const balanceAfter = current - line.quantity
        await tx.stockLevel.update({
          where: {
            productId_warehouseId: {
              productId: line.productId,
              warehouseId: data.warehouseId,
            },
          },
          data: { quantity: balanceAfter },
        })

        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            warehouseId: data.warehouseId,
            type: 'PURCHASE_RETURN',
            quantity: -line.quantity,
            balanceAfter,
            unitCost: line.unitPrice,
            reference: ref,
            sourceType: 'PurchaseReturn',
            sourceId: created.id,
            userId: user.id,
          },
        })
      }

      return ref
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'PurchaseReturn',
      summary: `Purchase return ${reference} raised`,
    })

    revalidatePath('/purchasing/returns')
    revalidatePath('/inventory/stock')

    return { success: `Purchase return ${reference} recorded.` }
  } catch (error) {
    if (error instanceof PurchaseError) return { error: error.message }
    console.error('createPurchaseReturn failed', error)
    return { error: 'The return could not be saved. Please try again.' }
  }
}

class PurchaseError extends Error {}
