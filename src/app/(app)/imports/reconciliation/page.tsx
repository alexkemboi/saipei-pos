import type { Metadata } from 'next'
import Link from 'next/link'
import { Scale } from 'lucide-react'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/page'
import { PrintButton } from '@/components/ui/print-button'
import { EmptyRow, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, formatKes, formatNumber, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Import reconciliation' }
export const dynamic = 'force-dynamic'

export default async function ReconciliationPage() {
  await requirePermission('imports.view')

  const orders = await db.importOrder.findMany({
    orderBy: { orderDate: 'desc' },
    include: {
      supplier: { select: { name: true } },
      charges: { select: { amountKes: true, isPaid: true } },
      shipments: {
        select: {
          numberOfBales: true,
          goodsReceipts: {
            select: {
              reference: true,
              numberOfBales: true,
              bales: { select: { landedCost: true } },
            },
          },
        },
      },
    },
  })

  const rows = orders.map((order) => {
    const goodsKes = toNumber(order.goodsValue) * toNumber(order.exchangeRate)
    const chargesKes = order.charges.reduce((sum, c) => sum + toNumber(c.amountKes), 0)
    const expected = goodsKes + chargesKes

    const shippedBales = order.shipments.reduce((sum, s) => sum + s.numberOfBales, 0)
    const receipts = order.shipments.flatMap((s) => s.goodsReceipts)
    const receivedBales = receipts.reduce((sum, r) => sum + r.numberOfBales, 0)
    const bookedCost = receipts.reduce(
      (sum, r) => sum + r.bales.reduce((t, b) => t + toNumber(b.landedCost), 0),
      0,
    )

    return {
      id: order.id,
      reference: order.reference,
      supplierName: order.supplier.name,
      orderDate: order.orderDate,
      stage: order.stage,
      goodsKes,
      chargesKes,
      expected,
      bookedCost,
      // Positive means more cost was incurred than has been booked into stock.
      costVariance: expected - bookedCost,
      shippedBales,
      receivedBales,
      baleVariance: receivedBales - shippedBales,
      unpaidCharges: order.charges
        .filter((c) => !c.isPaid)
        .reduce((sum, c) => sum + toNumber(c.amountKes), 0),
      hasReceipts: receipts.length > 0,
    }
  })

  const totalExpected = rows.reduce((sum, r) => sum + r.expected, 0)
  const totalBooked = rows.reduce((sum, r) => sum + r.bookedCost, 0)
  const unreconciled = rows.filter(
    (r) => r.hasReceipts && Math.abs(r.costVariance) > 1,
  ).length

  return (
    <>
      <PageHeader
        breadcrumb="Import & Clearing"
        title="Reconciliation"
        description="Does what each consignment cost match what was booked into stock?"
        action={<PrintButton label="Print reconciliation" />}
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total import cost"
          value={formatKes(totalExpected)}
          sublabel="goods plus all charges"
          tone="dark"
          icon={<Scale className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Booked into stock"
          value={formatKes(totalBooked)}
          sublabel="landed cost on received bales"
          tone="green"
        />
        <StatCard
          label="Difference"
          value={formatKes(totalExpected - totalBooked)}
          sublabel="cost not yet reflected in stock"
          tone={Math.abs(totalExpected - totalBooked) > 1 ? 'amber' : 'green'}
        />
        <StatCard
          label="Orders out of balance"
          value={formatNumber(unreconciled)}
          sublabel="received but not matching"
          tone={unreconciled > 0 ? 'red' : 'green'}
        />
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Import order</TH>
            <TH>Supplier</TH>
            <TH>Ordered</TH>
            <TH align="right">Goods</TH>
            <TH align="right">Charges</TH>
            <TH align="right">Total cost</TH>
            <TH align="right">Booked to stock</TH>
            <TH align="right">Variance</TH>
            <TH align="right">Bales ship/recv</TH>
            <TH>Stage</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={10} message="No import orders to reconcile." />
          ) : (
            rows.map((row) => {
              const balanced = !row.hasReceipts || Math.abs(row.costVariance) <= 1
              return (
                <TR key={row.id}>
                  <TD>
                    <Link
                      href={`/imports/${row.id}`}
                      className="tabular font-semibold text-saipei-dark-700 hover:underline"
                    >
                      {row.reference}
                    </Link>
                    {row.unpaidCharges > 0 ? (
                      <span className="block text-xs text-saipei-red-600">
                        {formatKes(row.unpaidCharges)} unpaid
                      </span>
                    ) : null}
                  </TD>
                  <TD>{row.supplierName}</TD>
                  <TD>{formatDate(row.orderDate)}</TD>
                  <TD align="right" numeric>
                    {formatKes(row.goodsKes)}
                  </TD>
                  <TD align="right" numeric>
                    {formatKes(row.chargesKes)}
                  </TD>
                  <TD align="right" numeric>
                    {formatKes(row.expected)}
                  </TD>
                  <TD align="right" numeric>
                    {row.hasReceipts ? formatKes(row.bookedCost) : '—'}
                  </TD>
                  <TD align="right" numeric>
                    {row.hasReceipts ? (
                      <span
                        className={
                          balanced ? 'text-saipei-green-700' : 'text-saipei-red-600'
                        }
                      >
                        {formatKes(row.costVariance)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TD>
                  <TD align="right" numeric>
                    {formatNumber(row.shippedBales)} / {formatNumber(row.receivedBales)}
                    {row.baleVariance !== 0 && row.hasReceipts ? (
                      <span className="block text-xs text-saipei-red-600">
                        {row.baleVariance > 0 ? '+' : ''}
                        {formatNumber(row.baleVariance)}
                      </span>
                    ) : null}
                  </TD>
                  <TD>
                    {!row.hasReceipts ? (
                      <StatusBadge status={row.stage} />
                    ) : balanced ? (
                      <Badge tone="success">Reconciled</Badge>
                    ) : (
                      <Badge tone="danger">Out of balance</Badge>
                    )}
                  </TD>
                </TR>
              )
            })
          )}
        </TBody>
      </Table>

      <p className="mt-3 text-xs text-saipei-gray-500">
        A variance means charges were captured against the order that were not included
        in the goods receipt, or the receipt was posted before all charges were known.
      </p>
    </>
  )
}
