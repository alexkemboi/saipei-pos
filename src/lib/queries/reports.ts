import 'server-only'
import { db } from '@/lib/db'
import { toNumber } from '@/lib/utils'

/** Sales that count as revenue — drafts and voids never do. */
export const REVENUE_STATUSES = ['COMPLETED', 'CREDIT', 'PARTIALLY_PAID']

export interface DateRange {
  from: Date
  to: Date
}

/** Resolves ?from=&to= into a range, defaulting to the current month. */
export function resolveRange(params: {
  from?: string
  to?: string
}): DateRange {
  const now = new Date()
  const from = params.from
    ? new Date(params.from)
    : new Date(now.getFullYear(), now.getMonth(), 1)
  const to = params.to ? new Date(params.to) : now
  to.setHours(23, 59, 59, 999)
  return { from, to }
}

export interface ProfitAndLoss {
  revenue: number
  costOfSales: number
  grossProfit: number
  grossMargin: number
  salesReturns: number
  expensesByCategory: { name: string; amount: number }[]
  totalExpenses: number
  importCharges: number
  netProfit: number
  netMargin: number
  transactionCount: number
}

/**
 * A trading profit and loss for the period.
 *
 * Cost of sales comes from the cost captured on each sale line at the moment
 * it was sold, so a later change to a product's cost price does not rewrite
 * history. Import charges are shown separately because they are already
 * carried in the landed cost of stock — they are informational, not a second
 * deduction, so they do not reduce net profit.
 */
export async function getProfitAndLoss(range: DateRange): Promise<ProfitAndLoss> {
  const [sales, returns, expenses, categories, charges] = await Promise.all([
    db.sale.aggregate({
      where: {
        saleDate: { gte: range.from, lte: range.to },
        status: { in: REVENUE_STATUSES },
      },
      _sum: { total: true, costOfSale: true },
      _count: true,
    }),
    db.salesReturn.aggregate({
      where: { returnDate: { gte: range.from, lte: range.to } },
      _sum: { totalAmount: true },
    }),
    db.expense.groupBy({
      by: ['categoryId'],
      where: {
        expenseDate: { gte: range.from, lte: range.to },
        status: 'APPROVED',
      },
      _sum: { amount: true },
    }),
    db.expenseCategory.findMany({ select: { id: true, name: true } }),
    db.landedCostCharge.aggregate({
      where: { chargeDate: { gte: range.from, lte: range.to } },
      _sum: { amountKes: true },
    }),
  ])

  const categoryNames = new Map(categories.map((c) => [c.id, c.name]))

  const grossRevenue = toNumber(sales._sum.total)
  const salesReturns = toNumber(returns._sum.totalAmount)
  const revenue = grossRevenue - salesReturns
  const costOfSales = toNumber(sales._sum.costOfSale)
  const grossProfit = revenue - costOfSales

  const expensesByCategory = expenses
    .map((row) => ({
      name: categoryNames.get(row.categoryId) ?? 'Uncategorised',
      amount: toNumber(row._sum.amount),
    }))
    .sort((a, b) => b.amount - a.amount)

  const totalExpenses = expensesByCategory.reduce((sum, row) => sum + row.amount, 0)
  const netProfit = grossProfit - totalExpenses

  return {
    revenue,
    costOfSales,
    grossProfit,
    grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    salesReturns,
    expensesByCategory,
    totalExpenses,
    importCharges: toNumber(charges._sum.amountKes),
    netProfit,
    netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
    transactionCount: sales._count,
  }
}

export interface DailySales {
  date: string
  revenue: number
  cost: number
  profit: number
  transactions: number
}

/** Revenue per day across the period, for the trend chart. */
export async function getDailySales(range: DateRange): Promise<DailySales[]> {
  const sales = await db.sale.findMany({
    where: {
      saleDate: { gte: range.from, lte: range.to },
      status: { in: REVENUE_STATUSES },
    },
    select: { saleDate: true, total: true, costOfSale: true },
  })

  const byDay = new Map<string, DailySales>()
  for (const sale of sales) {
    const key = sale.saleDate.toISOString().slice(0, 10)
    const current =
      byDay.get(key) ?? { date: key, revenue: 0, cost: 0, profit: 0, transactions: 0 }
    current.revenue += toNumber(sale.total)
    current.cost += toNumber(sale.costOfSale)
    current.profit = current.revenue - current.cost
    current.transactions += 1
    byDay.set(key, current)
  }

  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export interface ProductPerformance {
  productId: string
  sku: string
  name: string
  quantity: number
  revenue: number
  cost: number
  profit: number
  margin: number
}

/** Best (or worst) selling products over the period. */
export async function getProductPerformance(
  range: DateRange,
  limit = 20,
): Promise<ProductPerformance[]> {
  const lines = await db.saleLine.findMany({
    where: {
      sale: {
        saleDate: { gte: range.from, lte: range.to },
        status: { in: REVENUE_STATUSES },
      },
    },
    select: {
      productId: true,
      quantity: true,
      lineTotal: true,
      unitCost: true,
      product: { select: { sku: true, name: true } },
    },
  })

  const byProduct = new Map<string, ProductPerformance>()
  for (const line of lines) {
    const current =
      byProduct.get(line.productId) ??
      {
        productId: line.productId,
        sku: line.product.sku,
        name: line.product.name,
        quantity: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        margin: 0,
      }

    const quantity = toNumber(line.quantity)
    current.quantity += quantity
    current.revenue += toNumber(line.lineTotal)
    current.cost += quantity * toNumber(line.unitCost)
    current.profit = current.revenue - current.cost
    current.margin = current.revenue > 0 ? (current.profit / current.revenue) * 100 : 0
    byProduct.set(line.productId, current)
  }

  return [...byProduct.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}
