import type { Metadata } from 'next'
import Link from 'next/link'
import { PiggyBank, TrendingDown, TrendingUp } from 'lucide-react'
import { BarChart } from '@/components/ui/bar-chart'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  getDailySales,
  getProductPerformance,
  getProfitAndLoss,
} from '@/lib/queries/reports'
import { formatKes, formatNumber, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Profitability' }
export const dynamic = 'force-dynamic'

export default async function ProfitabilityPage() {
  await requirePermission('dashboard.financials')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  const [thisMonth, lastMonth, daily, products, stock] = await Promise.all([
    getProfitAndLoss({ from: startOfMonth, to: now }),
    getProfitAndLoss({ from: startOfLastMonth, to: endOfLastMonth }),
    getDailySales({ from: startOfMonth, to: now }),
    getProductPerformance({ from: startOfMonth, to: now }, 10),
    db.product.findMany({
      where: { isActive: true },
      select: {
        costPrice: true,
        sellingPrice: true,
        stockLevels: { select: { quantity: true } },
      },
    }),
  ])

  const stockAtCost = stock.reduce((sum, product) => {
    const quantity = product.stockLevels.reduce(
      (total, level) => total + toNumber(level.quantity),
      0,
    )
    return sum + quantity * toNumber(product.costPrice)
  }, 0)

  const stockAtRetail = stock.reduce((sum, product) => {
    const quantity = product.stockLevels.reduce(
      (total, level) => total + toNumber(level.quantity),
      0,
    )
    return sum + quantity * toNumber(product.sellingPrice)
  }, 0)

  const change = (current: number, previous: number) =>
    previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100

  const revenueChange = change(thisMonth.revenue, lastMonth.revenue)
  const profitChange = change(thisMonth.netProfit, lastMonth.netProfit)

  return (
    <>
      <PageHeader
        breadcrumb="Dashboard"
        title="Profitability"
        description="This month against last, and where the margin comes from."
        action={
          <Link href="/finance/profit-loss">
            <Button variant="secondary">Full profit &amp; loss</Button>
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue this month"
          value={formatKes(thisMonth.revenue)}
          sublabel={`last month ${formatKes(lastMonth.revenue)}`}
          tone="green"
          icon={<TrendingUp className="h-4 w-4" aria-hidden />}
          trend={
            revenueChange === null
              ? undefined
              : {
                  direction: revenueChange >= 0 ? 'up' : 'down',
                  label: `${Math.abs(revenueChange).toFixed(1)}%`,
                }
          }
        />
        <StatCard
          label="Gross profit"
          value={formatKes(thisMonth.grossProfit)}
          sublabel={`${thisMonth.grossMargin.toFixed(1)}% margin`}
          tone="green"
          icon={<PiggyBank className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Operating expenses"
          value={formatKes(thisMonth.totalExpenses)}
          sublabel={`last month ${formatKes(lastMonth.totalExpenses)}`}
          tone="red"
          icon={<TrendingDown className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Net profit"
          value={formatKes(thisMonth.netProfit)}
          sublabel={`${thisMonth.netMargin.toFixed(1)}% net margin`}
          tone={thisMonth.netProfit >= 0 ? 'green' : 'red'}
          trend={
            profitChange === null
              ? undefined
              : {
                  direction: profitChange >= 0 ? 'up' : 'down',
                  label: `${Math.abs(profitChange).toFixed(1)}%`,
                }
          }
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Stock at cost"
          value={formatKes(stockAtCost)}
          sublabel="capital tied up in inventory"
          tone="dark"
        />
        <StatCard
          label="Stock at retail"
          value={formatKes(stockAtRetail)}
          sublabel="if it all sells at list price"
          tone="dark"
        />
        <StatCard
          label="Profit still in stock"
          value={formatKes(stockAtRetail - stockAtCost)}
          sublabel={
            stockAtRetail > 0
              ? `${(((stockAtRetail - stockAtCost) / stockAtRetail) * 100).toFixed(1)}% margin`
              : 'no stock on hand'
          }
          tone="green"
        />
      </div>

      <div className="mb-5">
        <Card>
          <CardHeader
            title="Daily gross profit this month"
            description="The green column is profit; the darker one behind it is revenue."
          />
          <BarChart
            data={daily.map((day) => ({
              label: day.date.slice(8),
              value: day.profit,
              secondary: day.revenue,
            }))}
            valueLabel="Gross profit"
            secondaryLabel="Revenue"
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Where the profit comes from"
              description="Top products this month."
              action={
                <Link href="/reports/profit">
                  <Button variant="ghost" size="sm">
                    Full report
                  </Button>
                </Link>
              }
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH align="right">Sold</TH>
                  <TH align="right">Profit</TH>
                  <TH align="right">Margin</TH>
                </TR>
              </THead>
              <TBody>
                {products.length === 0 ? (
                  <EmptyRow colSpan={4} message="No sales this month." />
                ) : (
                  products.map((product) => (
                    <TR key={product.productId}>
                      <TD>
                        <span className="font-medium text-saipei-dark-800">
                          {product.name}
                        </span>
                        <span className="tabular block text-xs text-saipei-gray-500">
                          {product.sku}
                        </span>
                      </TD>
                      <TD align="right" numeric>
                        {formatNumber(product.quantity)}
                      </TD>
                      <TD align="right" numeric>
                        <span className="text-saipei-green-700">
                          {formatKes(product.profit)}
                        </span>
                      </TD>
                      <TD align="right" numeric>
                        {product.margin.toFixed(1)}%
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </table>
          </div>
        </Card>

        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Where the money goes"
              description="Operating expenses this month."
              action={
                <Link href="/finance/expenses">
                  <Button variant="ghost" size="sm">
                    Expenses
                  </Button>
                </Link>
              }
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Category</TH>
                  <TH align="right">Amount</TH>
                  <TH align="right">Share of revenue</TH>
                </TR>
              </THead>
              <TBody>
                {thisMonth.expensesByCategory.length === 0 ? (
                  <EmptyRow colSpan={3} message="No expenses recorded this month." />
                ) : (
                  thisMonth.expensesByCategory.map((row) => (
                    <TR key={row.name}>
                      <TD>
                        <span className="font-medium text-saipei-dark-800">
                          {row.name}
                        </span>
                      </TD>
                      <TD align="right" numeric>
                        <span className="text-saipei-red-600">
                          {formatKes(row.amount)}
                        </span>
                      </TD>
                      <TD align="right" numeric>
                        {thisMonth.revenue > 0
                          ? `${((row.amount / thisMonth.revenue) * 100).toFixed(1)}%`
                          : '—'}
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}
