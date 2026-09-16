'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit, requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { nextReference } from '@/lib/references'
import { toNumber } from '@/lib/utils'

export interface MovementState {
  error?: string
  success?: string
}

class MovementError extends Error {}

const round3 = (n: number) => Math.round(n * 1000) / 1000

/** Applies a signed change to a stock level and records the movement. */
async function applyMovement(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  args: {
    productId: string
    warehouseId: string
    change: number
    type: string
    reference: string
    sourceType: string
    sourceId: string
    userId: string
    notes?: string
    allowNegative?: boolean
  },
): Promise<number> {
  const level = await tx.stockLevel.findUnique({
    where: {
      productId_warehouseId: {
        productId: args.productId,
        warehouseId: args.warehouseId,
      },
    },
  })

  const current = toNumber(level?.quantity)
  const balanceAfter = round3(current + args.change)

  if (balanceAfter < 0 && !args.allowNegative) {
    const product = await tx.product.findUnique({
      where: { id: args.productId },
      select: { name: true },
    })
    throw new MovementError(
      `Only ${current} of ${product?.name ?? 'that product'} is in that warehouse.`,
    )
  }

  await tx.stockLevel.upsert({
    where: {
      productId_warehouseId: {
        productId: args.productId,
        warehouseId: args.warehouseId,
      },
    },
    update: { quantity: balanceAfter },
    create: {
      productId: args.productId,
      warehouseId: args.warehouseId,
      quantity: balanceAfter,
    },
  })

  const product = await tx.product.findUnique({
    where: { id: args.productId },
    select: { costPrice: true },
  })

  await tx.stockMovement.create({
    data: {
      productId: args.productId,
      warehouseId: args.warehouseId,
      type: args.type,
      quantity: args.change,
      balanceAfter,
      unitCost: toNumber(product?.costPrice),
      reference: args.reference,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      userId: args.userId,
      notes: args.notes ?? null,
    },
  })

  return balanceAfter
}

// ---------------------------------------------------------------------------
// Stock transfer
// ---------------------------------------------------------------------------

const transferSchema = z
  .object({
    fromWarehouseId: z.string().min(1, 'Choose the warehouse sending the stock'),
    toWarehouseId: z.string().min(1, 'Choose the warehouse receiving the stock'),
    notes: z.string().trim().max(400).optional(),
    lines: z
      .array(
        z.object({
          productId: z.string().min(1),
          quantity: z.number().positive(),
        }),
      )
      .min(1, 'Add at least one item to transfer'),
  })
  .refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
    message: 'Choose two different warehouses.',
    path: ['toWarehouseId'],
  })

export type TransferInput = z.input<typeof transferSchema>

export async function createStockTransfer(
  input: TransferInput,
): Promise<MovementState> {
  const user = await requirePermission('inventory.transfer')

  const parsed = transferSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the transfer details.' }
  }
  const data = parsed.data

  try {
    const reference = await db.$transaction(async (tx) => {
      const ref = await nextReference(tx, 'stockTransfer')

      const transfer = await tx.stockTransfer.create({
        data: {
          reference: ref,
          fromWarehouseId: data.fromWarehouseId,
          toWarehouseId: data.toWarehouseId,
          status: 'RECEIVED', // an internal move completes immediately
          createdById: user.id,
          notes: data.notes || null,
          lines: {
            create: data.lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
            })),
          },
        },
        select: { id: true },
      })

      for (const line of data.lines) {
        await applyMovement(tx, {
          productId: line.productId,
          warehouseId: data.fromWarehouseId,
          change: -line.quantity,
          type: 'TRANSFER_OUT',
          reference: ref,
          sourceType: 'StockTransfer',
          sourceId: transfer.id,
          userId: user.id,
        })
        await applyMovement(tx, {
          productId: line.productId,
          warehouseId: data.toWarehouseId,
          change: line.quantity,
          type: 'TRANSFER_IN',
          reference: ref,
          sourceType: 'StockTransfer',
          sourceId: transfer.id,
          userId: user.id,
        })
      }

      return ref
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'StockTransfer',
      summary: `Transfer ${reference} moved ${data.lines.length} item(s) between warehouses`,
    })

    revalidatePath('/inventory/transfers')
    revalidatePath('/inventory/stock')

    return { success: `Transfer ${reference} completed.` }
  } catch (error) {
    if (error instanceof MovementError) return { error: error.message }
    console.error('createStockTransfer failed', error)
    return { error: 'The transfer could not be saved. Please try again.' }
  }
}

// ---------------------------------------------------------------------------
// Stock adjustment
// ---------------------------------------------------------------------------

const adjustmentSchema = z.object({
  warehouseId: z.string().min(1, 'Choose the warehouse'),
  reason: z.enum([
    'DAMAGE',
    'LOSS',
    'THEFT',
    'EXPIRY',
    'COUNT_CORRECTION',
    'OPENING_BALANCE',
    'OTHER',
  ]),
  notes: z.string().trim().max(400).optional(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number(), // signed: negative writes stock off
      }),
    )
    .min(1, 'Add at least one item to adjust'),
})

export type AdjustmentInput = z.input<typeof adjustmentSchema>

export async function createStockAdjustment(
  input: AdjustmentInput,
): Promise<MovementState> {
  const user = await requirePermission('inventory.adjust')

  const parsed = adjustmentSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the adjustment details.' }
  }
  const data = parsed.data
  const lines = data.lines.filter((line) => line.quantity !== 0)
  if (lines.length === 0) {
    return { error: 'Enter a quantity for at least one item.' }
  }

  try {
    const reference = await db.$transaction(async (tx) => {
      const ref = await nextReference(tx, 'stockAdjustment')

      const adjustment = await tx.stockAdjustment.create({
        data: {
          reference: ref,
          warehouseId: data.warehouseId,
          reason: data.reason,
          status: 'APPROVED',
          userId: user.id,
          notes: data.notes || null,
          lines: {
            create: lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
            })),
          },
        },
        select: { id: true },
      })

      for (const line of lines) {
        await applyMovement(tx, {
          productId: line.productId,
          warehouseId: data.warehouseId,
          change: line.quantity,
          type: 'ADJUSTMENT',
          reference: ref,
          sourceType: 'StockAdjustment',
          sourceId: adjustment.id,
          userId: user.id,
          notes: data.reason,
        })
      }

      return ref
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'StockAdjustment',
      summary: `Adjustment ${reference} (${data.reason}) on ${lines.length} item(s)`,
    })

    revalidatePath('/inventory/adjustments')
    revalidatePath('/inventory/stock')

    return { success: `Adjustment ${reference} posted.` }
  } catch (error) {
    if (error instanceof MovementError) return { error: error.message }
    console.error('createStockAdjustment failed', error)
    return { error: 'The adjustment could not be saved. Please try again.' }
  }
}

// ---------------------------------------------------------------------------
// Stock take
// ---------------------------------------------------------------------------

const stockTakeSchema = z.object({
  warehouseId: z.string().min(1, 'Choose the warehouse'),
  notes: z.string().trim().max(400).optional(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        systemQty: z.number(),
        countedQty: z.number().min(0),
      }),
    )
    .min(1, 'Count at least one item'),
})

export type StockTakeInput = z.input<typeof stockTakeSchema>

/**
 * Posts a physical count: the counted quantity becomes the truth, and the
 * variance against the system figure is written as a stock movement.
 */
export async function postStockTake(input: StockTakeInput): Promise<MovementState> {
  const user = await requirePermission('inventory.stocktake')

  const parsed = stockTakeSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the count details.' }
  }
  const data = parsed.data
  const counted = data.lines.filter((line) => line.countedQty !== line.systemQty)

  try {
    const reference = await db.$transaction(async (tx) => {
      const ref = await nextReference(tx, 'stockTake')

      const stockTake = await tx.stockTake.create({
        data: {
          reference: ref,
          warehouseId: data.warehouseId,
          status: 'COMPLETED',
          userId: user.id,
          notes: data.notes || null,
          completedAt: new Date(),
          lines: {
            create: data.lines.map((line) => ({
              productId: line.productId,
              systemQty: line.systemQty,
              countedQty: line.countedQty,
              variance: round3(line.countedQty - line.systemQty),
            })),
          },
        },
        select: { id: true },
      })

      for (const line of counted) {
        await applyMovement(tx, {
          productId: line.productId,
          warehouseId: data.warehouseId,
          change: round3(line.countedQty - line.systemQty),
          type: 'STOCK_TAKE',
          reference: ref,
          sourceType: 'StockTake',
          sourceId: stockTake.id,
          userId: user.id,
          notes: 'Physical count correction',
          allowNegative: true, // the count is the truth, even if it is odd
        })
      }

      return ref
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'StockTake',
      summary: `Stock take ${reference} posted with ${counted.length} variance(s)`,
    })

    revalidatePath('/inventory/stock-take')
    revalidatePath('/inventory/stock')

    return {
      success:
        counted.length === 0
          ? `Stock take ${reference} posted — no variances found.`
          : `Stock take ${reference} posted with ${counted.length} variance(s) corrected.`,
    }
  } catch (error) {
    if (error instanceof MovementError) return { error: error.message }
    console.error('postStockTake failed', error)
    return { error: 'The stock take could not be saved. Please try again.' }
  }
}
