import type { Metadata } from 'next'
import { Card, CardHeader } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDateTime, formatNumber, toNumber } from '@/lib/utils'
import { StockTakeForm, type CountableProduct } from './stock-take-form'

export const metadata: Metadata = { title: 'Stock take' }
export const dynamic = 'force-dynamic'

export default async function StockTakePage() {
  await requirePermission('inventory.stocktake')

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
    db.stockTake.findMany({
      orderBy: { takeDate: 'desc' },
      take: 10,
      select: {
        id: true,
        reference: true,
        takeDate: true,
        status: true,
        notes: true,
        warehouse: { select: { name: true } },
        user: { select: { fullName: true } },
        lines: { select: { variance: true } },
      },
    }),
  ])

  if (warehouses.length === 0) {
    return (
      <>
        <PageHeader breadcrumb="Warehousing & Inventory" title="Stock take" />
        <Card>No active warehouse is configured.</Card>
      </>
    )
  }

  const countable: CountableProduct[] = products.map((product) => ({
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
        title="Stock take"
        description="Count the shelves and reconcile the system against what is physically there."
      />

      <StockTakeForm warehouses={warehouses} products={countable} />

      <div className="mt-6">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Previous stock takes" description="The last ten counts." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Reference</TH>
                  <TH>Date</TH>
                  <TH>Warehouse</TH>
                  <TH>Counted by</TH>
                  <TH align="right">Items</TH>
                  <TH align="right">Variances</TH>
                  <TH align="right">Net</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {history.length === 0 ? (
                  <EmptyRow colSpan={8} message="No stock takes recorded yet." />
                ) : (
                  history.map((take) => {
                    const variances = take.lines.filter(
                      (line) => toNumber(line.variance) !== 0,
                    )
                    const net = take.lines.reduce(
                      (sum, line) => sum + toNumber(line.variance),
                      0,
                    )
                    return (
                      <TR key={take.id}>
                        <TD>
                          <span className="tabular font-semibold text-saipei-dark-700">
                            {take.reference}
                          </span>
                          {take.notes ? (
                            <span className="block text-xs text-saipei-gray-500">
                              {take.notes}
                            </span>
                          ) : null}
                        </TD>
                        <TD>{formatDateTime(take.takeDate)}</TD>
                        <TD>{take.warehouse.name}</TD>
                        <TD>{take.user?.fullName ?? '—'}</TD>
                        <TD align="right" numeric>
                          {formatNumber(take.lines.length)}
                        </TD>
                        <TD align="right" numeric>
                          {formatNumber(variances.length)}
                        </TD>
                        <TD align="right" numeric>
                          <span
                            className={
                              net === 0
                                ? 'text-saipei-gray-500'
                                : net > 0
                                  ? 'text-saipei-green-700'
                                  : 'text-saipei-red-600'
                            }
                          >
                            {net > 0 ? '+' : ''}
                            {formatNumber(net)}
                          </span>
                        </TD>
                        <TD>
                          <StatusBadge status={take.status} />
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
