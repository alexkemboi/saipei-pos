import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDateTime, formatKes, toNumber } from '@/lib/utils'
import { SalesReturnForm, type ReturnableSale } from './return-form'

export const metadata: Metadata = { title: 'Sales returns' }
export const dynamic = 'force-dynamic'

export default async function SalesReturnsPage() {
  await requirePermission('sales.return')

  const [warehouse, sales, history] = await Promise.all([
    db.warehouse.findFirst({
      where: { isActive: true },
      orderBy: { isDefault: 'desc' },
      select: { id: true },
    }),
    db.sale.findMany({
      where: { status: { in: ['COMPLETED', 'CREDIT', 'PARTIALLY_PAID'] } },
      orderBy: { saleDate: 'desc' },
      take: 100,
      select: {
        id: true,
        reference: true,
        total: true,
        customer: { select: { name: true } },
        lines: {
          select: {
            id: true,
            productId: true,
            description: true,
            quantity: true,
            unitPrice: true,
          },
        },
        returns: { select: { lines: { select: { productId: true, quantity: true } } } },
      },
    }),
    db.salesReturn.findMany({
      orderBy: { returnDate: 'desc' },
      take: 15,
      select: {
        id: true,
        reference: true,
        returnDate: true,
        totalAmount: true,
        isRestocked: true,
        reason: true,
        sale: { select: { id: true, reference: true } },
        customer: { select: { name: true } },
      },
    }),
  ])

  if (!warehouse) {
    return (
      <>
        <PageHeader breadcrumb="Sales & POS" title="Sales returns" />
        <Card>No active warehouse is configured, so stock cannot be returned.</Card>
      </>
    )
  }

  const returnable: ReturnableSale[] = sales.map((sale) => {
    const returnedByProduct = new Map<string, number>()
    for (const ret of sale.returns) {
      for (const line of ret.lines) {
        returnedByProduct.set(
          line.productId,
          (returnedByProduct.get(line.productId) ?? 0) + toNumber(line.quantity),
        )
      }
    }

    return {
      id: sale.id,
      reference: sale.reference,
      customerName: sale.customer?.name ?? 'Walk-in customer',
      total: toNumber(sale.total),
      lines: sale.lines.map((line) => ({
        id: line.id,
        productId: line.productId,
        description: line.description,
        quantity: toNumber(line.quantity),
        returned: returnedByProduct.get(line.productId) ?? 0,
        unitPrice: toNumber(line.unitPrice),
      })),
    }
  })

  return (
    <>
      <PageHeader
        breadcrumb="Sales & POS"
        title="Sales returns"
        description="Take goods back against the original receipt and return them to stock."
      />

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1.4fr_1fr]">
        <SalesReturnForm sales={returnable} warehouseId={warehouse.id} />

        <Card padded={false} className="self-start">
          <div className="px-5 pt-5">
            <CardHeader title="Recent returns" description="The last fifteen returns." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Reference</TH>
                  <TH>Original sale</TH>
                  <TH>Date</TH>
                  <TH align="right">Amount</TH>
                  <TH>Stock</TH>
                </TR>
              </THead>
              <TBody>
                {history.length === 0 ? (
                  <EmptyRow colSpan={5} message="No returns recorded yet." />
                ) : (
                  history.map((ret) => (
                    <TR key={ret.id}>
                      <TD>
                        <span className="tabular font-medium text-saipei-dark-700">
                          {ret.reference}
                        </span>
                        {ret.reason ? (
                          <span className="block text-xs text-saipei-gray-500">
                            {ret.reason}
                          </span>
                        ) : null}
                      </TD>
                      <TD>
                        {ret.sale ? (
                          <Link
                            href={`/sales/${ret.sale.id}`}
                            className="tabular hover:underline"
                          >
                            {ret.sale.reference}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TD>
                      <TD>{formatDateTime(ret.returnDate)}</TD>
                      <TD align="right" numeric>
                        <span className="text-saipei-red-600">
                          −{formatKes(ret.totalAmount)}
                        </span>
                      </TD>
                      <TD>
                        {ret.isRestocked ? (
                          <Badge tone="success">Restocked</Badge>
                        ) : (
                          <Badge tone="neutral">Written off</Badge>
                        )}
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
