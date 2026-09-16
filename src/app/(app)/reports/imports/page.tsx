import type { Metadata } from 'next'
import { Container, Ship, Truck } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { ListFilters } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { PrintButton } from '@/components/ui/print-button'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { resolveRange } from '@/lib/queries/reports'
import { formatDate, formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Import reports' }
export const dynamic = 'force-dynamic'

export default async function ImportReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requirePermission('reports.view')
  const params = await searchParams
  const range = resolveRange(params)

  const [orders, chargesByCategory, shipments] = await Promise.all([
    db.importOrder.findMany({
      where: { orderDate: { gte: range.from, lte: range.to } },
      orderBy: { orderDate: 'desc' },
      select: {
        id: true,
        reference: true,
        orderDate: true,
        stage: true,
        currency: true,
        exchangeRate: true,
        goodsValue: true,
        supplier: { select: { name: true } },
        charges: { select: { amountKes: true } },
        shipments: { select: { numberOfBales: true, totalWeightKg: true } },
      },
    }),
    db.landedCostCharge.groupBy({
      by: ['category'],
      where: { chargeDate: { gte: range.from, lte: range.to } },
      _sum: { amountKes: true },
      _count: { _all: true },
    }),
    db.shipment.findMany({
      where: {
        OR: [
          { actualArrival: { gte: range.from, lte: range.to } },
          { departureDate: { gte: range.from, lte: range.to } },
        ],
      },
      select: {
        id: true,
        reference: true,
        containerNumber: true,
        departureDate: true,
        expectedArrival: true,
        actualArrival: true,
        status: true,
        numberOfBales: true,
        importOrder: { select: { reference: true } },
      },
    }),
  ])

  const rows = orders.map((order) => {
    const goodsKes = toNumber(order.goodsValue) * toNumber(order.exchangeRate)
    const chargesKes = order.charges.reduce((sum, c) => sum + toNumber(c.amountKes), 0)
    const bales = order.shipments.reduce((sum, s) => sum + s.numberOfBales, 0)
    return {
      ...order,
      goodsKes,
      chargesKes,
      landed: goodsKes + chargesKes,
      bales,
      // How much the charges add on top of the goods themselves.
      uplift: goodsKes > 0 ? (chargesKes / goodsKes) * 100 : 0,
    }
  })

  const totalGoods = rows.reduce((sum, r) => sum + r.goodsKes, 0)
  const totalCharges = rows.reduce((sum, r) => sum + r.chargesKes, 0)
  const totalBales = rows.reduce((sum, r) => sum + r.bales, 0)

  // Transit time, for the shipments that actually completed the voyage.
  const sailed = shipments.filter((s) => s.departureDate && s.actualArrival)
  const averageTransitDays =
    sailed.length > 0
      ? sailed.reduce(
          (sum, s) =>
            sum +
            (s.actualArrival!.getTime() - s.departureDate!.getTime()) /
              (1000 * 60 * 60 * 24),
          0,
        ) / sailed.length
      : 0

  return (
    <>
      <PageHeader
        breadcrumb="Reports & Analytics"
        title="Import report"
        description={`Consignments and landed cost, ${formatDate(range.from)} to ${formatDate(range.to)}.`}
        action={<PrintButton label="Print report" />}
      />

      <div className="no-print">
        <ListFilters showSearch={false} showDateRange />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Goods value"
          value={formatKes(totalGoods)}
          sublabel={`${formatNumber(rows.length)} import orders`}
          tone="dark"
          icon={<Container className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Import charges"
          value={formatKes(totalCharges)}
          sublabel={
            totalGoods > 0
              ? `${((totalCharges / totalGoods) * 100).toFixed(1)}% on top of goods`
              : 'no goods value recorded'
          }
          tone="red"
          icon={<Truck className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Total landed cost"
          value={formatKes(totalGoods + totalCharges)}
          sublabel={
            totalBales > 0
              ? `${formatKes((totalGoods + totalCharges) / totalBales)} per bale`
              : 'no bales recorded'
          }
          tone="green"
        />
        <StatCard
          label="Average transit"
          value={averageTransitDays > 0 ? `${averageTransitDays.toFixed(0)} days` : '—'}
          sublabel={`${formatNumber(sailed.length)} completed voyages`}
          tone="dark"
          icon={<Ship className="h-4 w-4" aria-hidden />}
        />
      </div>

      <div className="mb-5">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Charges by category"
              description="Where the money goes between the factory and the warehouse."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Category</TH>
                  <TH align="right">Charges</TH>
                  <TH align="right">Total</TH>
                  <TH align="right">Share</TH>
                </TR>
              </THead>
              <TBody>
                {chargesByCategory.length === 0 ? (
                  <EmptyRow colSpan={4} message="No import charges in this period." />
                ) : (
                  chargesByCategory
                    .map((row) => ({
                      category: row.category,
                      count: row._count._all,
                      amount: toNumber(row._sum.amountKes),
                    }))
                    .sort((a, b) => b.amount - a.amount)
                    .map((row) => {
                      const grand = chargesByCategory.reduce(
                        (sum, r) => sum + toNumber(r._sum.amountKes),
                        0,
                      )
                      const share = grand > 0 ? (row.amount / grand) * 100 : 0
                      return (
                        <TR key={row.category}>
                          <TD>
                            <span className="font-medium text-saipei-dark-800">
                              {humanize(row.category)}
                            </span>
                          </TD>
                          <TD align="right" numeric>
                            {formatNumber(row.count)}
                          </TD>
                          <TD align="right" numeric>
                            {formatKes(row.amount)}
                          </TD>
                          <TD align="right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-saipei-gray-200">
                                <div
                                  className="h-full rounded-full bg-saipei-green-500"
                                  style={{ width: `${share}%` }}
                                />
                              </div>
                              <span className="tabular w-12 text-right text-saipei-gray-600">
                                {share.toFixed(1)}%
                              </span>
                            </div>
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

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Import orders in the period"
            description="Landed cost against the value of the goods themselves."
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <THead>
              <TR>
                <TH>Reference</TH>
                <TH>Supplier</TH>
                <TH>Ordered</TH>
                <TH align="right">Goods</TH>
                <TH align="right">Charges</TH>
                <TH align="right">Uplift</TH>
                <TH align="right">Landed</TH>
                <TH align="right">Bales</TH>
                <TH>Stage</TH>
              </TR>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={9} message="No import orders in this period." />
              ) : (
                rows.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <span className="tabular font-semibold text-saipei-dark-700">
                        {row.reference}
                      </span>
                    </TD>
                    <TD>{row.supplier.name}</TD>
                    <TD>{formatDate(row.orderDate)}</TD>
                    <TD align="right" numeric>
                      {formatKes(row.goodsKes)}
                    </TD>
                    <TD align="right" numeric>
                      {formatKes(row.chargesKes)}
                    </TD>
                    <TD align="right" numeric>
                      <span
                        className={
                          row.uplift > 50
                            ? 'text-saipei-red-600'
                            : row.uplift > 25
                              ? 'text-saipei-amber-700'
                              : 'text-saipei-green-700'
                        }
                      >
                        {row.uplift.toFixed(1)}%
                      </span>
                    </TD>
                    <TD align="right" numeric>
                      {formatKes(row.landed)}
                    </TD>
                    <TD align="right" numeric>
                      {formatNumber(row.bales)}
                    </TD>
                    <TD>
                      <StatusBadge status={row.stage} />
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </table>
        </div>
      </Card>
    </>
  )
}
