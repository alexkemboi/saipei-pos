'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit, requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { nextReference } from '@/lib/references'
import { toNumber } from '@/lib/utils'

export interface PaymentState {
  error?: string
  success?: string
}

const schema = z.object({
  customerId: z.string().min(1, 'Choose a customer'),
  amount: z.coerce.number().positive('Enter an amount greater than zero'),
  method: z.enum(['CASH', 'MPESA', 'BANK_TRANSFER', 'CHEQUE', 'CARD']),
  mpesaCode: z.string().trim().max(40).optional(),
  bankReference: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(400).optional(),
})

/**
 * Records money received from a customer and applies it to their oldest
 * unsettled credit sales first, so the ageing of the debt stays honest.
 */
export async function recordCustomerPayment(
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const user = await requirePermission('finance.payments')

  const parsed = schema.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    method: formData.get('method'),
    mpesaCode: formData.get('mpesaCode') ?? undefined,
    bankReference: formData.get('bankReference') ?? undefined,
    notes: formData.get('notes') ?? undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the payment details.' }
  }
  const data = parsed.data

  try {
    const result = await db.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: data.customerId },
        select: { id: true, name: true, balance: true },
      })
      if (!customer) throw new Error('CUSTOMER_MISSING')

      const balance = toNumber(customer.balance)
      if (data.amount > balance) {
        throw new PaymentError(
          `${customer.name} only owes ${balance.toFixed(2)}. Enter that amount or less.`,
        )
      }

      const reference = await nextReference(tx, 'receipt')
      await tx.receipt.create({
        data: {
          reference,
          customerId: customer.id,
          method: data.method,
          status: 'COMPLETED',
          amount: data.amount,
          mpesaCode: data.mpesaCode || null,
          bankReference: data.bankReference || null,
          notes: data.notes || null,
          userId: user.id,
        },
      })

      // Apply the money to the oldest open credit sales first.
      let remaining = data.amount
      const openSales = await tx.sale.findMany({
        where: {
          customerId: customer.id,
          status: { in: ['CREDIT', 'PARTIALLY_PAID'] },
        },
        orderBy: { saleDate: 'asc' },
        select: { id: true, total: true, amountPaid: true },
      })

      for (const sale of openSales) {
        if (remaining <= 0) break
        const due = toNumber(sale.total) - toNumber(sale.amountPaid)
        if (due <= 0) continue

        const applied = Math.min(due, remaining)
        remaining = round2(remaining - applied)
        const newPaid = round2(toNumber(sale.amountPaid) + applied)

        await tx.sale.update({
          where: { id: sale.id },
          data: {
            amountPaid: newPaid,
            status: newPaid >= toNumber(sale.total) ? 'COMPLETED' : 'PARTIALLY_PAID',
          },
        })
      }

      await tx.customer.update({
        where: { id: customer.id },
        data: { balance: round2(balance - data.amount) },
      })

      return { reference, customerName: customer.name }
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'Receipt',
      summary: `Received ${data.amount} from ${result.customerName} (${result.reference})`,
    })

    revalidatePath('/sales/payments')
    revalidatePath('/sales/credit')
    revalidatePath('/sales/customers')
    revalidatePath('/dashboard')

    return {
      success: `Receipt ${result.reference} recorded against ${result.customerName}.`,
    }
  } catch (error) {
    if (error instanceof PaymentError) return { error: error.message }
    console.error('recordCustomerPayment failed', error)
    return { error: 'The payment could not be recorded. Please try again.' }
  }
}

class PaymentError extends Error {}

const round2 = (n: number) => Math.round(n * 100) / 100
