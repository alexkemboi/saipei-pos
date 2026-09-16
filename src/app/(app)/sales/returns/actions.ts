'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit, requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { nextReference } from '@/lib/references'
import { toNumber } from '@/lib/utils'

export interface ReturnState {
  error?: string
  success?: string
}

const schema = z.object({
  saleId: z.string().min(1, 'Choose the original sale'),
  warehouseId: z.string().min(1),
  reason: z.string().trim().max(400).optional(),
  restock: z.boolean().default(true),
  lines: z
    .array(
      z.object({
        saleLineId: z.string().min(1),
        quantity: z.number().min(0),
      }),
    )
    .min(1),
})

export type ReturnInput = z.input<typeof schema>

/**
 * Reverses part or all of a sale: credits the customer (or refunds cash),
 * and puts the goods back into stock unless they came back damaged.
 */
export async function createSalesReturn(input: ReturnInput): Promise<ReturnState> {
  const user = await requirePermission('sales.return')

  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the return details.' }
  }
  const data = parsed.data
  const returning = data.lines.filter((l) => l.quantity > 0)
  if (returning.length === 0) {
    return { error: 'Enter a quantity for at least one item.' }
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: data.saleId },
        include: { lines: true, customer: { select: { id: true, name: true } } },
      })
      if (!sale) throw new ReturnError('That sale no longer exists.')

      const lineById = new Map(sale.lines.map((l) => [l.id, l]))

      // Anything already returned cannot be returned twice.
      const priorReturns = await tx.salesReturnLine.findMany({
        where: { salesReturn: { saleId: sale.id } },
        select: { productId: true, quantity: true },
      })
      const returnedByProduct = new Map<string, number>()
      for (const prior of priorReturns) {
        returnedByProduct.set(
          prior.productId,
          (returnedByProduct.get(prior.productId) ?? 0) + toNumber(prior.quantity),
        )
      }

      let totalAmount = 0
      const returnLines = returning.map((line) => {
        const saleLine = lineById.get(line.saleLineId)
        if (!saleLine) throw new ReturnError('An item is not part of that sale.')

        const alreadyReturned = returnedByProduct.get(saleLine.productId) ?? 0
        const returnable = toNumber(saleLine.quantity) - alreadyReturned
        if (line.quantity > returnable) {
          throw new ReturnError(
            `Only ${returnable} of ${saleLine.description} can still be returned.`,
          )
        }

        const unitPrice = toNumber(saleLine.unitPrice)
        const lineTotal = round2(unitPrice * line.quantity)
        totalAmount += lineTotal

        return {
          productId: saleLine.productId,
          quantity: line.quantity,
          unitPrice,
          lineTotal,
          unitCost: toNumber(saleLine.unitCost),
        }
      })

      totalAmount = round2(totalAmount)
      const reference = await nextReference(tx, 'salesReturn')

      await tx.salesReturn.create({
        data: {
          reference,
          saleId: sale.id,
          customerId: sale.customerId,
          reason: data.reason || null,
          totalAmount,
          isRestocked: data.restock,
          lines: {
            create: returnLines.map(({ unitCost: _unitCost, ...line }) => line),
          },
        },
      })

      if (data.restock) {
        for (const line of returnLines) {
          const level = await tx.stockLevel.findUnique({
            where: {
              productId_warehouseId: {
                productId: line.productId,
                warehouseId: data.warehouseId,
              },
            },
          })
          const balanceAfter = round3(toNumber(level?.quantity) + line.quantity)

          await tx.stockLevel.upsert({
            where: {
              productId_warehouseId: {
                productId: line.productId,
                warehouseId: data.warehouseId,
              },
            },
            update: { quantity: balanceAfter },
            create: {
              productId: line.productId,
              warehouseId: data.warehouseId,
              quantity: balanceAfter,
            },
          })

          await tx.stockMovement.create({
            data: {
              productId: line.productId,
              warehouseId: data.warehouseId,
              type: 'SALE_RETURN',
              quantity: line.quantity,
              balanceAfter,
              unitCost: line.unitCost,
              reference,
              sourceType: 'SalesReturn',
              sourceId: sale.id,
              userId: user.id,
            },
          })
        }
      }

      // A credit sale reduces the debt; a settled sale is refunded.
      if (sale.isCredit && sale.customerId) {
        const outstanding = toNumber(sale.total) - toNumber(sale.amountPaid)
        const creditBack = Math.min(totalAmount, outstanding)
        if (creditBack > 0) {
          await tx.customer.update({
            where: { id: sale.customerId },
            data: { balance: { decrement: creditBack } },
          })
        }
      }

      return { reference, totalAmount, customerName: sale.customer?.name }
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'SalesReturn',
      summary: `Sales return ${result.reference} for ${result.totalAmount}`,
    })

    revalidatePath('/sales/returns')
    revalidatePath('/sales')
    revalidatePath('/inventory/stock')

    return {
      success: `Return ${result.reference} recorded for ${result.totalAmount.toFixed(2)}.`,
    }
  } catch (error) {
    if (error instanceof ReturnError) return { error: error.message }
    console.error('createSalesReturn failed', error)
    return { error: 'The return could not be saved. Please try again.' }
  }
}

class ReturnError extends Error {}

const round2 = (n: number) => Math.round(n * 100) / 100
const round3 = (n: number) => Math.round(n * 1000) / 1000
