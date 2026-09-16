'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit, requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { nextReference } from '@/lib/references'
import { toNumber } from '@/lib/utils'

export interface GrnState {
  error?: string
  success?: string
  reference?: string
}

const baleSchema = z.object({
  baleNumber: z.string().trim().min(1, 'Every bale needs a number'),
  shoeType: z.string().trim().min(1, 'Describe the type of shoes in the bale'),
  weightKg: z.number().min(0),
  balePrice: z.number().min(0),
  piecesEstimate: z.number().int().min(0),
  productId: z.string().trim().optional(),
})

const schema = z.object({
  warehouseId: z.string().min(1, 'Choose the receiving warehouse'),
  shipmentId: z.string().trim().optional(),
  containerNumber: z.string().trim().max(40).optional(),
  receiptDate: z.string().trim().optional(),
  verifiedBy: z.string().trim().max(140).optional(),
  notes: z.string().trim().max(600).optional(),
  containerCost: z.number().min(0).default(0),
  offloadingCost: z.number().min(0).default(0),
  transportCost: z.number().min(0).default(0),
  warehouseCost: z.number().min(0).default(0),
  bales: z.array(baleSchema).min(1, 'Add at least one bale'),
})

export type GrnInput = z.input<typeof schema>

/**
 * Receives a container of bales.
 *
 * The landed cost of the container (bale prices plus offloading, transport and
 * warehouse charges) is spread across the bales by value, then across the
 * estimated pieces, so the cost each product carries reflects what it actually
 * cost to get it onto the shelf.
 */
export async function createGoodsReceipt(input: GrnInput): Promise<GrnState> {
  const user = await requirePermission('inventory.receive')

  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the receiving details.' }
  }
  const data = parsed.data

  const balesValue = data.bales.reduce((sum, bale) => sum + bale.balePrice, 0)
  const extraCosts =
    data.containerCost +
    data.offloadingCost +
    data.transportCost +
    data.warehouseCost

  try {
    const result = await db.$transaction(async (tx) => {
      const duplicates = await tx.bale.findMany({
        where: { baleNumber: { in: data.bales.map((b) => b.baleNumber) } },
        select: { baleNumber: true },
      })
      if (duplicates.length > 0) {
        throw new GrnError(
          `Bale ${duplicates[0].baleNumber} has already been received.`,
        )
      }

      const reference = await nextReference(tx, 'goodsReceipt')

      const receipt = await tx.goodsReceipt.create({
        data: {
          reference,
          shipmentId: data.shipmentId || null,
          warehouseId: data.warehouseId,
          receiptDate: data.receiptDate ? new Date(data.receiptDate) : new Date(),
          containerNumber: data.containerNumber || null,
          numberOfBales: data.bales.length,
          totalWeightKg: data.bales.reduce((sum, b) => sum + b.weightKg, 0),
          containerCost: data.containerCost,
          offloadingCost: data.offloadingCost,
          transportCost: data.transportCost,
          warehouseCost: data.warehouseCost,
          verifiedBy: data.verifiedBy || null,
          notes: data.notes || null,
          isPosted: true,
        },
        select: { id: true, reference: true },
      })

      // --- Bales, with landed cost apportioned by value ------------------
      for (const bale of data.bales) {
        const share = balesValue > 0 ? bale.balePrice / balesValue : 1 / data.bales.length
        const landedCost = round2(bale.balePrice + extraCosts * share)

        await tx.bale.create({
          data: {
            baleNumber: bale.baleNumber,
            goodsReceiptId: receipt.id,
            warehouseId: data.warehouseId,
            productId: bale.productId || null,
            shoeType: bale.shoeType,
            weightKg: bale.weightKg,
            balePrice: bale.balePrice,
            landedCost,
            piecesEstimate: bale.piecesEstimate,
          },
        })

        if (!bale.productId || bale.piecesEstimate <= 0) continue

        const unitCost = round4(landedCost / bale.piecesEstimate)

        await tx.goodsReceiptLine.create({
          data: {
            goodsReceiptId: receipt.id,
            productId: bale.productId,
            quantity: bale.piecesEstimate,
            unitCost,
            lineTotal: landedCost,
          },
        })

        // --- Stock in, at weighted average cost --------------------------
        const level = await tx.stockLevel.findUnique({
          where: {
            productId_warehouseId: {
              productId: bale.productId,
              warehouseId: data.warehouseId,
            },
          },
        })
        const existingQty = toNumber(level?.quantity)
        const balanceAfter = round3(existingQty + bale.piecesEstimate)

        await tx.stockLevel.upsert({
          where: {
            productId_warehouseId: {
              productId: bale.productId,
              warehouseId: data.warehouseId,
            },
          },
          update: { quantity: balanceAfter },
          create: {
            productId: bale.productId,
            warehouseId: data.warehouseId,
            quantity: balanceAfter,
          },
        })

        const product = await tx.product.findUnique({
          where: { id: bale.productId },
          select: { costPrice: true },
        })
        const oldCost = toNumber(product?.costPrice)
        const weightedCost =
          balanceAfter > 0
            ? round4(
                (existingQty * oldCost + bale.piecesEstimate * unitCost) / balanceAfter,
              )
            : unitCost

        await tx.product.update({
          where: { id: bale.productId },
          data: { costPrice: weightedCost },
        })

        await tx.stockMovement.create({
          data: {
            productId: bale.productId,
            warehouseId: data.warehouseId,
            type: 'GRN',
            quantity: bale.piecesEstimate,
            balanceAfter,
            unitCost,
            reference: receipt.reference,
            sourceType: 'GoodsReceipt',
            sourceId: receipt.id,
            userId: user.id,
            notes: `Bale ${bale.baleNumber}`,
          },
        })
      }

      // Receiving the goods moves the shipment on.
      if (data.shipmentId) {
        await tx.shipment.update({
          where: { id: data.shipmentId },
          data: { status: 'DELIVERED' },
        })
      }

      return receipt
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'GoodsReceipt',
      entityId: result.id,
      summary: `GRN ${result.reference} received with ${data.bales.length} bales`,
    })

    revalidatePath('/inventory/receiving')
    revalidatePath('/inventory/stock')
    revalidatePath('/inventory/bales')
    revalidatePath('/dashboard')

    return {
      success: `Goods receipt ${result.reference} posted — ${data.bales.length} bales received into stock.`,
      reference: result.reference,
    }
  } catch (error) {
    if (error instanceof GrnError) return { error: error.message }
    console.error('createGoodsReceipt failed', error)
    return { error: 'The goods receipt could not be saved. Please try again.' }
  }
}

class GrnError extends Error {}

const round2 = (n: number) => Math.round(n * 100) / 100
const round3 = (n: number) => Math.round(n * 1000) / 1000
const round4 = (n: number) => Math.round(n * 10000) / 10000
