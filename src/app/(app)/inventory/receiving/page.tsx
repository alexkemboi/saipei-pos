import type { Metadata } from 'next'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, formatKes, formatNumber, toNumber } from '@/lib/utils'
import { GoodsReceiptForm } from './grn-form'

export const metadata: Metadata = { title: 'Goods receiving' }
export const dynamic = 'force-dynamic'

export default async function ReceivingPage() {
  await requirePermission('inventory.receive')

  const [warehouses, products, shipments, history] = await Promise.all([
    db.warehouse.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, code: true },
    }),
    db.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, sku: true, name: true },
    }),
    db.shipment.findMany({
      where: { status: { in: ['ARRIVED', 'CLEARED'] } },
      orderBy: { actualArrival: 'desc' },
      select: { id: true, reference: true, containerNumber: true },
    }),
    db.goodsReceipt.findMany({
      orderBy: { receiptDate: 'desc' },
      take: 15,
      select: {
        id: true,
        reference: true,
        receiptDate: true,
        containerNumber: true,
        numberOfBales: true,
        totalWeightKg: true,
        containerCost: true,
        offloadingCost: true,
        transportCost: true,
        warehouseCost: true,
        warehouse: { select: { name: true } },
        bales: { select: { balePrice: true } },
      },
    }),
  ])

  if (warehouses.length === 0) {
    return (
      <>
        <PageHeader breadcrumb="Warehousing & Inventory" title="Goods receiving" />
        <Card>No active warehouse is configured. Add one before receiving goods.</Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        breadcrumb="Warehousing & Inventory"
        title="Goods receiving"
        description="Verify a consignment on arrival and book the bales into stock at landed cost."
      />

      <GoodsReceiptForm
        warehouses={warehouses}
        products={products}
        shipments={shipments}
      />

      <div className="mt-6">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Recent goods receipts"
              description="The last fifteen consignments received."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>GRN</TH>
                  <TH>Date</TH>
                  <TH>Warehouse</TH>
                  <TH>Container</TH>
                  <TH align="right">Bales</TH>
                  <TH align="right">Weight (kg)</TH>
                  <TH align="right">Landed cost</TH>
                </TR>
              </THead>
              <TBody>
                {history.length === 0 ? (
                  <EmptyRow colSpan={7} message="No goods receipts recorded yet." />
                ) : (
                  history.map((grn) => {
                    const landed =
                      grn.bales.reduce((sum, b) => sum + toNumber(b.balePrice), 0) +
                      toNumber(grn.containerCost) +
                      toNumber(grn.offloadingCost) +
                      toNumber(grn.transportCost) +
                      toNumber(grn.warehouseCost)

                    return (
                      <TR key={grn.id}>
                        <TD>
                          <span className="tabular font-semibold text-saipei-dark-700">
                            {grn.reference}
                          </span>
                        </TD>
                        <TD>{formatDate(grn.receiptDate)}</TD>
                        <TD>{grn.warehouse.name}</TD>
                        <TD>
                          <span className="tabular">{grn.containerNumber ?? '—'}</span>
                        </TD>
                        <TD align="right" numeric>
                          {formatNumber(grn.numberOfBales)}
                        </TD>
                        <TD align="right" numeric>
                          {formatNumber(grn.totalWeightKg, 2)}
                        </TD>
                        <TD align="right" numeric>
                          {formatKes(landed)}
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
