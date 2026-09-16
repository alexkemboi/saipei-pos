import type { Metadata } from 'next'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, formatKes, formatNumber, toNumber } from '@/lib/utils'
import { PurchaseReturnForm, type ReturnableProduct } from './return-form'

export const metadata: Metadata = { title: 'Purchase returns' }
export const dynamic = 'force-dynamic'

export default async function PurchaseReturnsPage() {
  await requirePermission('purchasing.manage')

  const [suppliers, warehouses, products, history] = await Promise.all([
    db.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
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
        costPrice: true,
        stockLevels: { select: { warehouseId: true, quantity: true } },
      },
    }),
    db.purchaseReturn.findMany({
      orderBy: { returnDate: 'desc' },
      take: 15,
      select: {
        id: true,
        reference: true,
        returnDate: true,
        reason: true,
        totalAmount: true,
        supplier: { select: { name: true } },
        lines: { select: { quantity: true } },
      },
    }),
  ])

  if (warehouses.length === 0 || suppliers.length === 0) {
    return (
      <>
        <PageHeader breadcrumb="Purchasing" title="Purchase returns" />
        <Card>An active supplier and warehouse are needed before goods can be returned.</Card>
      </>
    )
  }

  const returnable: ReturnableProduct[] = products.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    costPrice: toNumber(product.costPrice),
    stockByWarehouse: Object.fromEntries(
      product.stockLevels.map((level) => [level.warehouseId, toNumber(level.quantity)]),
    ),
  }))

  return (
    <>
      <PageHeader
        breadcrumb="Purchasing"
        title="Purchase returns"
        description="Send goods back to a supplier and take them out of stock."
      />

      <PurchaseReturnForm
        suppliers={suppliers}
        warehouses={warehouses}
        products={returnable}
      />

      <div className="mt-6">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Recent returns" description="The last fifteen returns." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Reference</TH>
                  <TH>Supplier</TH>
                  <TH>Date</TH>
                  <TH>Reason</TH>
                  <TH align="right">Items</TH>
                  <TH align="right">Value</TH>
                </TR>
              </THead>
              <TBody>
                {history.length === 0 ? (
                  <EmptyRow colSpan={6} message="No purchase returns recorded yet." />
                ) : (
                  history.map((ret) => (
                    <TR key={ret.id}>
                      <TD>
                        <span className="tabular font-semibold text-saipei-dark-700">
                          {ret.reference}
                        </span>
                      </TD>
                      <TD>{ret.supplier.name}</TD>
                      <TD>{formatDate(ret.returnDate)}</TD>
                      <TD>
                        <span className="text-saipei-gray-600">{ret.reason ?? '—'}</span>
                      </TD>
                      <TD align="right" numeric>
                        {formatNumber(ret.lines.length)}
                      </TD>
                      <TD align="right" numeric>
                        <span className="text-saipei-red-600">
                          {formatKes(ret.totalAmount)}
                        </span>
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
