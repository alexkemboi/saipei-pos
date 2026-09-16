import type { Metadata } from 'next'
import { Card, CardHeader } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDateTime, formatNumber, toNumber } from '@/lib/utils'
import { StockTransferForm, type TransferProduct } from './transfer-form'

export const metadata: Metadata = { title: 'Stock transfers' }
export const dynamic = 'force-dynamic'

export default async function TransfersPage() {
  await requirePermission('inventory.transfer')

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
    db.stockTransfer.findMany({
      orderBy: { transferDate: 'desc' },
      take: 15,
      select: {
        id: true,
        reference: true,
        transferDate: true,
        status: true,
        notes: true,
        fromWarehouse: { select: { name: true } },
        toWarehouse: { select: { name: true } },
        createdBy: { select: { fullName: true } },
        lines: { select: { quantity: true } },
      },
    }),
  ])

  if (warehouses.length < 2) {
    return (
      <>
        <PageHeader breadcrumb="Warehousing & Inventory" title="Stock transfers" />
        <Card>
          At least two active warehouses are needed before stock can be transferred.
        </Card>
      </>
    )
  }

  const transferProducts: TransferProduct[] = products.map((product) => ({
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
        title="Stock transfers"
        description="Move stock from the warehouse to the shop, or between stores."
      />

      <StockTransferForm warehouses={warehouses} products={transferProducts} />

      <div className="mt-6">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Recent transfers" description="The last fifteen movements." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Reference</TH>
                  <TH>Date</TH>
                  <TH>From</TH>
                  <TH>To</TH>
                  <TH>By</TH>
                  <TH align="right">Items</TH>
                  <TH align="right">Units</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {history.length === 0 ? (
                  <EmptyRow colSpan={8} message="No transfers recorded yet." />
                ) : (
                  history.map((transfer) => (
                    <TR key={transfer.id}>
                      <TD>
                        <span className="tabular font-semibold text-saipei-dark-700">
                          {transfer.reference}
                        </span>
                      </TD>
                      <TD>{formatDateTime(transfer.transferDate)}</TD>
                      <TD>{transfer.fromWarehouse.name}</TD>
                      <TD>{transfer.toWarehouse.name}</TD>
                      <TD>{transfer.createdBy?.fullName ?? '—'}</TD>
                      <TD align="right" numeric>
                        {formatNumber(transfer.lines.length)}
                      </TD>
                      <TD align="right" numeric>
                        {formatNumber(
                          transfer.lines.reduce(
                            (sum, line) => sum + toNumber(line.quantity),
                            0,
                          ),
                        )}
                      </TD>
                      <TD>
                        <StatusBadge status={transfer.status} />
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
