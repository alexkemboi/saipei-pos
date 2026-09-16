import 'server-only'
import { db } from '@/lib/db'

type Counter =
  | 'sale'
  | 'receipt'
  | 'payment'
  | 'purchaseOrder'
  | 'importOrder'
  | 'shipment'
  | 'goodsReceipt'
  | 'stockTransfer'
  | 'stockAdjustment'
  | 'stockTake'
  | 'salesReturn'
  | 'purchaseReturn'
  | 'expense'
  | 'cashSession'
  | 'supplier'
  | 'customer'
  | 'product'

const PREFIXES: Record<Counter, string> = {
  sale: 'SAL',
  receipt: 'RCP',
  payment: 'PAY',
  purchaseOrder: 'LPO',
  importOrder: 'IMP',
  shipment: 'SHP',
  goodsReceipt: 'GRN',
  stockTransfer: 'TRF',
  stockAdjustment: 'ADJ',
  stockTake: 'STK',
  salesReturn: 'SRT',
  purchaseReturn: 'PRT',
  expense: 'EXP',
  cashSession: 'CSH',
  supplier: 'SUP',
  customer: 'CUS',
  product: 'PRD',
}

/**
 * Document references look like SAL-2026-0001.
 *
 * The counter lives in the Setting table and is bumped inside the caller's
 * transaction, so two tills cannot be handed the same number. Callers must
 * pass the transaction client they are writing the document with.
 */
export async function nextReference(
  tx: Pick<typeof db, 'setting'>,
  counter: Counter,
  date = new Date(),
): Promise<string> {
  const year = date.getFullYear()
  const key = `counter.${counter}.${year}`

  const existing = await tx.setting.findUnique({ where: { key } })
  const next = (existing ? Number(existing.value) || 0 : 0) + 1

  await tx.setting.upsert({
    where: { key },
    update: { value: String(next) },
    create: { key, value: String(next), group: 'counters' },
  })

  return `${PREFIXES[counter]}-${year}-${String(next).padStart(4, '0')}`
}
