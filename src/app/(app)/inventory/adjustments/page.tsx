import type { Metadata } from 'next'
import { Card, CardHeader } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDateTime, formatNumber, humanize, toNumber } from '@/lib/utils'
import { StockAdjustmentForm, type AdjustmentProduct } from './adjustment-form'

export const metadata: Metadata = { title: 'Stock adjustments' }
export const dynamic = 'force-dynamic'

export default async function AdjustmentsPage() {
  await requirePermission('inventory.adjust')

  const [warehouses, products, history] = await Promise.all([
    db.warehouse.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
    db.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        sku: true,
        name: true,
        stockLevels: { select: { warehouseId: true, quantity: true } },
      },
    }),
    db.stockAdjustment.findMany({
      orderBy: { adjustmentDate: 'desc' },
      take: 15,
      select: {
        id: true,
        reference: true,
        adjustmentDate: true,
        reason: true,
        status: true,
        notes: true,
        warehouse: { select: { name: true } },
        user: { select: { fullName: true } },
        lines: { select: { quantity: true } },
      },
    }),
  ])

  if (warehouses.length === 0) {
    return (
      <>
        <PageHeader breadcrumb="Warehousing & Inventory" title="Stock adjustments" />
        <Card>No active warehouse is configured.</Card>
      </>
    )
  }

  const adjustmentProducts: AdjustmentProduct[] = products.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    stockByWarehouse: Object.fromEntries(
      product.stockLevels.map((level) => [level.warehouseId, toNumber(level.quantity)]),
    ),
  }))

  return (
    <>
      <PageHeader
        breadcrumb="Warehousing & Inventory"
        title="Stock adjustments"
        description="Write off damage and loss, or correct a quantity that is wrong."
      />

      <StockAdjustmentForm warehouses={warehouses} products={adjustmentProducts} />

      <div className="mt-6">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Recent adjustments"
              description="The last fifteen adjustments posted."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Reference</TH>
                  <TH>Date</TH>
                  <TH>Warehouse</TH>
                  <TH>Reason</TH>
                  <TH>By</TH>
                  <TH align="right">Items</TH>
                  <TH align="right">Net units</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {history.length === 0 ? (
                  <EmptyRow colSpan={8} message="No adjustments recorded yet." />
                ) : (
                  history.map((adjustment) => {
                    const net = adjustment.lines.reduce(
                      (sum, line) => sum + toNumber(line.quantity),
                      0,
                    )
                    return (
                      <TR key={adjustment.id}>
                        <TD>
                          <span className="tabular font-semibold text-saipei-dark-700">
                            {adjustment.reference}
                          </span>
                          {adjustment.notes ? (
                            <span className="block text-xs text-saipei-gray-500">
                              {adjustment.notes}
                            </span>
                          ) : null}
                        </TD>
                        <TD>{formatDateTime(adjustment.adjustmentDate)}</TD>
                        <TD>{adjustment.warehouse.name}</TD>
                        <TD>{humanize(adjustment.reason)}</TD>
                        <TD>{adjustment.user?.fullName ?? '—'}</TD>
                        <TD align="right" numeric>
                          {formatNumber(adjustment.lines.length)}
                        </TD>
                        <TD align="right" numeric>
                          <span
                            className={
                              net >= 0 ? 'text-saipei-green-700' : 'text-saipei-red-600'
                            }
                          >
                            {net >= 0 ? '+' : ''}
                            {formatNumber(net)}
                          </span>
                        </TD>
                        <TD>
                          <StatusBadge status={adjustment.status} />
                        </TD>
                      </TR>
                    )
                  })
                )}
              </TBody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}
