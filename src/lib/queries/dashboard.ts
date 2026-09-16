import 'server-only'
import { db } from '@/lib/db'
import { toNumber } from '@/lib/utils'

/** Import stages that still need operational attention. */
const ACTIVE_IMPORT_STAGES = [
  'ORDER_PLACED',
  'SUPPLIER_INVOICED',
  'DEPOSIT_PAID',
  'DOCUMENTATION',
  'LOADED',
  'IN_TRANSIT',
  'ARRIVED',
  'CLEARING',
  'RELEASED',
]

const IN_TRANSIT_SHIPMENT_STATUSES = ['LOADED', 'DEPARTED', 'ARRIVED']

/** Sales that count as revenue - drafts and voids never do. */
const REVENUE_STATUSES = ['COMPLETED', 'CREDIT', 'PARTIALLY_PAID']

export interface DashboardMetrics {
  salesToday: number
  saleCountToday: number
  salesThisMonth: number
  saleCountThisMonth: number
  grossProfitThisMonth: number
  marginThisMonth: number
  debtorsTotal: number
  debtorCount: number
  totalStockUnits: number
  activeImports: number
  shipmentsInTransit: number
  lowStockCount: number
  supplierPayables: number
  unpaidInvoiceCount: number
  recentSales: {
    id: string
    reference: string
    customerName: string | null
    saleDate: Date
    total: number
    status: string
  }[]
  importPipeline: { stage: string; count: number }[]
  lowStockItems: {
    id: string
    sku: string
    name: string
    quantity: number
    reorderLevel: number
  }[]
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    today,
    month,
    debtors,
    stockSum,
    activeImports,
    shipmentsInTransit,
    payables,
    recentSalesRows,
    pipelineRows,
    products,
  ] = await Promise.all([
    db.sale.aggregate({
      where: { saleDate: { gte: startOfDay }, status: { in: REVENUE_STATUSES } },
      _sum: { total: true },
      _count: true,
    }),
    db.sale.aggregate({
      where: { saleDate: { gte: startOfMonth }, status: { in: REVENUE_STATUSES } },
      _sum: { total: true, costOfSale: true },
      _count: true,
    }),
    db.customer.aggregate({
      where: { balance: { gt: 0 } },
      _sum: { balance: true },
      _count: true,
    }),
    db.stockLevel.aggregate({ _sum: { quantity: true } }),
    db.importOrder.count({ where: { stage: { in: ACTIVE_IMPORT_STAGES } } }),
    db.shipment.count({ where: { status: { in: IN_TRANSIT_SHIPMENT_STATUSES } } }),
    db.supplierInvoice.findMany({
      where: { status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
      select: { amount: true, amountPaid: true, exchangeRate: true },
    }),
    db.sale.findMany({
      where: { status: { not: 'DRAFT' } },
      orderBy: { saleDate: 'desc' },
      take: 10,
      select: {
        id: true,
        reference: true,
        saleDate: true,
        total: true,
        status: true,
        customer: { select: { name: true } },
      },
    }),
    db.importOrder.groupBy({
      by: ['stage'],
      where: { stage: { in: ACTIVE_IMPORT_STAGES } },
      _count: { _all: true },
    }),
    // Reorder level lives on the product and stock on StockLevel, so the
    // comparison is done here rather than in SQL.
    db.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        sku: true,
        name: true,
        reorderLevel: true,
        stockLevels: { select: { quantity: true } },
      },
    }),
  ])

  const salesThisMonth = toNumber(month._sum.total)
  const costThisMonth = toNumber(month._sum.costOfSale)
  const grossProfitThisMonth = salesThisMonth - costThisMonth

  const supplierPayables = payables.reduce(
    (sum, invoice) =>
      sum +
      (toNumber(invoice.amount) - toNumber(invoice.amountPaid)) *
        toNumber(invoice.exchangeRate),
    0,
  )

  const lowStockItems = products
    .map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      quantity: product.stockLevels.reduce(
        (sum, level) => sum + toNumber(level.quantity),
        0,
      ),
      reorderLevel: toNumber(product.reorderLevel),
    }))
    .filter((item) => item.quantity <= item.reorderLevel)
    .sort((a, b) => a.quantity - b.quantity)

  return {
    salesToday: toNumber(today._sum.total),
    saleCountToday: today._count,
    salesThisMonth,
    saleCountThisMonth: month._count,
    grossProfitThisMonth,
    marginThisMonth:
      salesThisMonth > 0 ? (grossProfitThisMonth / salesThisMonth) * 100 : 0,
    debtorsTotal: toNumber(debtors._sum.balance),
    debtorCount: debtors._count,
    totalStockUnits: toNumber(stockSum._sum.quantity),
    activeImports,
    shipmentsInTransit,
    lowStockCount: lowStockItems.length,
    supplierPayables,
    unpaidInvoiceCount: payables.length,
    recentSales: recentSalesRows.map((sale) => ({
      id: sale.id,
      reference: sale.reference,
      customerName: sale.customer?.name ?? null,
      saleDate: sale.saleDate,
      total: toNumber(sale.total),
      status: sale.status,
    })),
    importPipeline: pipelineRows
      .map((row) => ({ stage: row.stage, count: row._count._all }))
      .sort(
        (a, b) =>
          ACTIVE_IMPORT_STAGES.indexOf(a.stage) -
          ACTIVE_IMPORT_STAGES.indexOf(b.stage),
      ),
    lowStockItems: lowStockItems.slice(0, 8),
  }
}
