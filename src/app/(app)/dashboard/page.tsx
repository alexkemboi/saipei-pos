import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  Banknote,
  Boxes,
  PiggyBank,
  Receipt,
  Ship,
  ShoppingCart,
  Users,
} from 'lucide-react'
import { StatusBadge, StockBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert } from '@/components/ui/form'
import { PageHeader, StatCard } from '@/components/ui/page'
import {
  EmptyRow,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { getDashboardMetrics } from '@/lib/queries/dashboard'
import { formatDate, formatKes, formatNumber } from '@/lib/utils'
import { hasPermission as can } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>
}) {
  const user = await requirePermission('dashboard.view')
  const { denied } = await searchParams
  const showFinancials = can(user.permissions, 'dashboard.financials')
  const metrics = await getDashboardMetrics()

  return (
    <>
      <PageHeader
        breadcrumb="Dashboard"
        title={`Karibu, ${user.fullName.split(' ')[0]}`}
        description="Today's trading position across sales, stock, imports and debtors."
        action={
          can(user.permissions, 'pos.sell') ? (
            <Link href="/pos">
              <Button
                variant="danger"
                icon={<ShoppingCart className="h-4 w-4" aria-hidden />}
              >
                Open POS
              </Button>
            </Link>
          ) : null
        }
      />

      {denied ? (
        <div className="mb-5">
          <Alert tone="warning" title="Access denied">
            Your role does not have permission to open that page. Speak to an
            administrator if you need access.
          </Alert>
        </div>
      ) : null}

      {/* --- Headline figures ------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sales today"
          value={formatKes(metrics.salesToday)}
          sublabel={`${formatNumber(metrics.saleCountToday)} transactions`}
          tone="green"
          icon={<Receipt className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Sales this month"
          value={formatKes(metrics.salesThisMonth)}
          sublabel={`${formatNumber(metrics.saleCountThisMonth)} transactions`}
          tone="dark"
          icon={<Banknote className="h-4 w-4" aria-hidden />}
        />
        {showFinancials ? (
          <StatCard
            label="Gross profit (month)"
            value={formatKes(metrics.grossProfitThisMonth)}
            sublabel={`${metrics.marginThisMonth.toFixed(1)}% margin`}
            tone="green"
            icon={<PiggyBank className="h-4 w-4" aria-hidden />}
          />
        ) : (
          <StatCard
            label="Stock on hand"
            value={formatNumber(metrics.totalStockUnits)}
            sublabel="units across all warehouses"
            tone="dark"
            icon={<Boxes className="h-4 w-4" aria-hidden />}
          />
        )}
        <StatCard
          label="Outstanding debtors"
          value={formatKes(metrics.debtorsTotal)}
          sublabel={`${formatNumber(metrics.debtorCount)} customers on credit`}
          tone="red"
          icon={<Users className="h-4 w-4" aria-hidden />}
        />
      </div>

      {/* --- Operational figures ----------------------------------------- */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active imports"
          value={formatNumber(metrics.activeImports)}
          sublabel="orders in the pipeline"
          tone="dark"
          icon={<Ship className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Shipments in transit"
          value={formatNumber(metrics.shipmentsInTransit)}
          sublabel="at sea or clearing"
          tone="dark"
          icon={<Ship className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Low stock items"
          value={formatNumber(metrics.lowStockCount)}
          sublabel="at or below reorder level"
          tone="amber"
          icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Unpaid supplier invoices"
          value={formatKes(metrics.supplierPayables)}
          sublabel={`${formatNumber(metrics.unpaidInvoiceCount)} invoices`}
          tone="red"
          icon={<Banknote className="h-4 w-4" aria-hidden />}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* --- Recent sales --------------------------------------------- */}
        <Card className="xl:col-span-2" padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Recent sales"
              description="The last ten transactions recorded at the till."
              action={
                <Link href="/sales">
                  <Button variant="ghost" size="sm">
                    View all
                  </Button>
                </Link>
              }
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Reference</TH>
                  <TH>Customer</TH>
                  <TH>Date</TH>
                  <TH align="right">Total</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {metrics.recentSales.length === 0 ? (
                  <EmptyRow colSpan={5} message="No sales recorded yet." />
                ) : (
                  metrics.recentSales.map((sale) => (
                    <TR key={sale.id}>
                      <TD>
                        <span className="tabular font-medium text-saipei-dark-800">
                          {sale.reference}
                        </span>
                      </TD>
                      <TD>{sale.customerName ?? 'Walk-in customer'}</TD>
                      <TD>{formatDate(sale.saleDate)}</TD>
                      <TD align="right" numeric>
                        {formatKes(sale.total)}
                      </TD>
                      <TD>
                        <StatusBadge status={sale.status} />
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </table>
          </div>
        </Card>

        {/* --- Import pipeline ------------------------------------------ */}
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Import pipeline"
              description="Where each order sits right now."
              action={
                <Link href="/imports">
                  <Button variant="ghost" size="sm">
                    Open
                  </Button>
                </Link>
              }
            />
          </div>
          <ul className="divide-y divide-saipei-gray-100">
            {metrics.importPipeline.length === 0 ? (
              <li className="px-5 py-10 text-center text-sm text-saipei-gray-500">
                No active import orders.
              </li>
            ) : (
              metrics.importPipeline.map((stage) => (
                <li
                  key={stage.stage}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <StatusBadge status={stage.stage} />
                  <span className="tabular text-sm font-semibold text-saipei-dark-800">
                    {formatNumber(stage.count)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      {/* --- Stock needing attention ------------------------------------ */}
      <div className="mt-5">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Stock needing attention"
              description="Items at or below their reorder level."
              action={
                <Link href="/inventory/stock">
                  <Button variant="ghost" size="sm">
                    Manage stock
                  </Button>
                </Link>
              }
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>SKU</TH>
                  <TH>Product</TH>
                  <TH align="right">On hand</TH>
                  <TH align="right">Reorder level</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {metrics.lowStockItems.length === 0 ? (
                  <EmptyRow
                    colSpan={5}
                    message="Every product is above its reorder level."
                  />
                ) : (
                  metrics.lowStockItems.map((item) => (
                    <TR key={item.id}>
                      <TD>
                        <span className="tabular text-saipei-gray-600">
                          {item.sku}
                        </span>
                      </TD>
                      <TD>
                        <span className="font-medium text-saipei-dark-800">
                          {item.name}
                        </span>
                      </TD>
                      <TD align="right" numeric>
                        {formatNumber(item.quantity)}
                      </TD>
                      <TD align="right" numeric>
                        {formatNumber(item.reorderLevel)}
                      </TD>
                      <TD>
                        <StockBadge
                          quantity={item.quantity}
                          reorderLevel={item.reorderLevel}
                        />
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
