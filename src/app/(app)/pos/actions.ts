'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { audit, requirePermission } from '@/lib/auth'
import { nextReference } from '@/lib/references'
import { toNumber } from '@/lib/utils'

const lineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  discount: z.number().min(0).default(0),
})

const saleSchema = z
  .object({
    warehouseId: z.string().min(1),
    customerId: z.string().nullable().optional(),
    lines: z.array(lineSchema).min(1, 'Add at least one item to the sale.'),
    method: z.enum(['CASH', 'MPESA', 'BANK_TRANSFER', 'CARD', 'CREDIT']),
    amountTendered: z.number().min(0).default(0),
    mpesaCode: z.string().trim().max(40).optional(),
    notes: z.string().trim().max(400).optional(),
  })
  .refine((data) => data.method !== 'CREDIT' || Boolean(data.customerId), {
    message: 'A credit sale must be attached to a customer account.',
    path: ['customerId'],
  })

export type SaleInput = z.input<typeof saleSchema>

export type SaleResult =
  | { ok: true; saleId: string; reference: string; change: number }
  | { ok: false; error: string }

/**
 * Completes a sale atomically: prices come from the database (never the
 * client), stock is decremented, movements and the receipt are written, and a
 * credit sale updates the customer balance.
 */
export async function completeSale(input: SaleInput): Promise<SaleResult> {
  const user = await requirePermission('pos.sell')

  const parsed = saleSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid sale.' }
  }
  const data = parsed.data

  // A client may send the same product on more than one line. Merge them so
  // the stock check and the decrement below see one row per product.
  const mergedLines = [...
    data.lines
      .reduce((map, line) => {
        const existing = map.get(line.productId)
        map.set(line.productId, {
          productId: line.productId,
          quantity: (existing?.quantity ?? 0) + line.quantity,
          discount: (existing?.discount ?? 0) + line.discount,
        })
        return map
      }, new Map<string, { productId: string; quantity: number; discount: number }>())
      .values(),
  ]

  try {
    const result = await db.$transaction(async (tx) => {
      // --- Re-read products and stock under the transaction --------------
      const productIds = mergedLines.map((l) => l.productId)
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          sellingPrice: true,
          costPrice: true,
          taxRate: true,
        },
      })
      const productById = new Map(products.map((p) => [p.id, p]))

      const stockLevels = await tx.stockLevel.findMany({
        where: { productId: { in: productIds }, warehouseId: data.warehouseId },
      })
      const stockByProduct = new Map(stockLevels.map((s) => [s.productId, s]))

      // --- Build the lines from trusted data -----------------------------
      let subtotal = 0
      let discountTotal = 0
      let taxTotal = 0
      let costOfSale = 0

      const lines = mergedLines.map((line) => {
        const product = productById.get(line.productId)
        if (!product) throw new SaleError('A product on the sale no longer exists.')

        const available = toNumber(stockByProduct.get(line.productId)?.quantity)
        if (available < line.quantity) {
          throw new SaleError(
            `Not enough stock for ${product.name}: ${available} available.`,
          )
        }

        const unitPrice = toNumber(product.sellingPrice)
        const unitCost = toNumber(product.costPrice)
        const taxRate = toNumber(product.taxRate)

        const gross = unitPrice * line.quantity
        const discount = Math.min(line.discount, gross)
        const net = gross - discount
        // Prices are VAT-inclusive, so back the tax out of the net amount.
        const taxAmount = taxRate > 0 ? net - net / (1 + taxRate / 100) : 0

        subtotal += gross
        discountTotal += discount
        taxTotal += taxAmount
        costOfSale += unitCost * line.quantity

        return {
          productId: product.id,
          description: product.name,
          quantity: line.quantity,
          unitPrice,
          discount,
          taxRate,
          taxAmount: round2(taxAmount),
          unitCost,
          lineTotal: round2(net),
        }
      })

      const total = round2(subtotal - discountTotal)
      const isCredit = data.method === 'CREDIT'
      const amountPaid = isCredit ? 0 : total
      const change = isCredit
        ? 0
        : Math.max(0, round2(data.amountTendered - total))

      if (!isCredit && data.method === 'CASH' && data.amountTendered < total) {
        throw new SaleError('The amount tendered is less than the total due.')
      }

      // --- Credit limit --------------------------------------------------
      if (isCredit && data.customerId) {
        const customer = await tx.customer.findUnique({
          where: { id: data.customerId },
          select: { balance: true, creditLimit: true, name: true },
        })
        if (!customer) throw new SaleError('That customer no longer exists.')

        const limit = toNumber(customer.creditLimit)
        const newBalance = toNumber(customer.balance) + total
        if (limit > 0 && newBalance > limit) {
          throw new SaleError(
            `${customer.name} would exceed their credit limit. Take a payment first.`,
          )
        }
      }

      const reference = await nextReference(tx, 'sale')

      const sale = await tx.sale.create({
        data: {
          reference,
          channel: 'POS',
          customerId: data.customerId || null,
          cashierId: user.id,
          cashSessionId: await openCashSessionId(tx, user.id),
          subtotal: round2(subtotal),
          discount: round2(discountTotal),
          taxAmount: round2(taxTotal),
          total,
          amountPaid,
          changeGiven: change,
          costOfSale: round2(costOfSale),
          status: isCredit ? 'CREDIT' : 'COMPLETED',
          isCredit,
          notes: data.notes || null,
          lines: { create: lines },
        },
        select: { id: true, reference: true, cashSessionId: true },
      })

      // --- Stock: decrement level, record the movement --------------------
      for (const line of lines) {
        const current = toNumber(stockByProduct.get(line.productId)?.quantity)
        const balanceAfter = round3(current - line.quantity)

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
            type: 'SALE',
            quantity: -line.quantity,
            balanceAfter,
            unitCost: line.unitCost,
            reference: sale.reference,
            sourceType: 'Sale',
            sourceId: sale.id,
            userId: user.id,
          },
        })
      }

      // --- Money ----------------------------------------------------------
      if (isCredit) {
        await tx.customer.update({
          where: { id: data.customerId! },
          data: { balance: { increment: total } },
        })
      } else {
        const receiptRef = await nextReference(tx, 'receipt')
        await tx.receipt.create({
          data: {
            reference: receiptRef,
            customerId: data.customerId || null,
            saleId: sale.id,
            cashSessionId: sale.cashSessionId,
            method: data.method,
            status: 'COMPLETED',
            amount: total,
            mpesaCode: data.mpesaCode || null,
            userId: user.id,
          },
        })
      }

      return { saleId: sale.id, reference: sale.reference, change }
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'Sale',
      entityId: result.saleId,
      summary: `Sale ${result.reference} completed at the till`,
    })

    revalidatePath('/pos')
    revalidatePath('/sales')
    revalidatePath('/dashboard')

    return { ok: true, ...result }
  } catch (error) {
    if (error instanceof SaleError) return { ok: false, error: error.message }
    console.error('completeSale failed', error)
    return {
      ok: false,
      error: 'The sale could not be saved. Nothing was charged — please try again.',
    }
  }
}

/** A sale is only ever attributed to the cashier's own open session. */
async function openCashSessionId(
  tx: Pick<typeof db, 'cashSession'>,
  userId: string,
): Promise<string | null> {
  const session = await tx.cashSession.findFirst({
    where: { userId, status: 'OPEN' },
    select: { id: true },
  })
  return session?.id ?? null
}

class SaleError extends Error {}

const round2 = (n: number) => Math.round(n * 100) / 100
const round3 = (n: number) => Math.round(n * 1000) / 1000
