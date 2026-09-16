import 'server-only'
import { db } from '@/lib/db'
import { toNumber } from '@/lib/utils'

export interface PosProduct {
  id: string
  sku: string
  barcode: string | null
  name: string
  categoryId: string | null
  categoryName: string | null
  unit: string
  sellingPrice: number
  costPrice: number
  taxRate: number
  quantity: number
  reorderLevel: number
}

export interface PosCustomer {
  id: string
  code: string
  name: string
  phone: string | null
  balance: number
  creditLimit: number
}

export interface PosTillData {
  warehouseId: string
  warehouseName: string
  products: PosProduct[]
  categories: { id: string; name: string }[]
  customers: PosCustomer[]
  vatRate: number
  cashSession: { id: string; reference: string; openedAt: Date } | null
}

/** Everything the till screen needs, in one round trip. */
export async function getTillData(userId: string): Promise<PosTillData> {
  const [warehouse, categories, customers, vatSetting, cashSession] =
    await Promise.all([
      db.warehouse.findFirst({
        where: { isActive: true },
        orderBy: { isDefault: 'desc' },
      }),
      db.category.findMany({ orderBy: { name: 'asc' } }),
      db.customer.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          phone: true,
          balance: true,
          creditLimit: true,
        },
      }),
      db.setting.findUnique({ where: { key: 'tax.vatRate' } }),
      db.cashSession.findFirst({
        where: { userId, status: 'OPEN' },
        select: { id: true, reference: true, openedAt: true },
      }),
    ])

  if (!warehouse) {
    throw new Error('No active warehouse is configured.')
  }

  const products = await db.product.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      sku: true,
      barcode: true,
      name: true,
      unit: true,
      sellingPrice: true,
      costPrice: true,
      taxRate: true,
      reorderLevel: true,
      categoryId: true,
      category: { select: { name: true } },
      stockLevels: {
        where: { warehouseId: warehouse.id },
        select: { quantity: true },
      },
    },
  })

  return {
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    customers: customers.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      phone: c.phone,
      balance: toNumber(c.balance),
      creditLimit: toNumber(c.creditLimit),
    })),
    vatRate: vatSetting ? Number(vatSetting.value) || 0 : 0,
    cashSession,
    products: products.map((p) => ({
      id: p.id,
      sku: p.sku,
      barcode: p.barcode,
      name: p.name,
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      unit: p.unit,
      sellingPrice: toNumber(p.sellingPrice),
      costPrice: toNumber(p.costPrice),
      taxRate: toNumber(p.taxRate),
      reorderLevel: toNumber(p.reorderLevel),
      quantity: p.stockLevels.reduce((sum, s) => sum + toNumber(s.quantity), 0),
    })),
  }
}
