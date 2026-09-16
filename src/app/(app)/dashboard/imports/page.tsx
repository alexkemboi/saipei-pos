import type { Metadata } from 'next'
import Link from 'next/link'
import { Anchor, Container, Ship, Truck } from 'lucide-react'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Import status' }
export const dynamic = 'force-dynamic'

const ACTIVE_STAGES = [
  'ORDER_PLACED',
  'SUPPLIER_INVOICED',
  'DEPOSIT_PAID',
  'DOCUMENTATION',
  'LOADED',
  'IN_TRANSIT',
  'ARRIVED',
  'CLEARING',
  'RELEASED',
]

export default async function ImportStatusPage() {
  await requirePermission('dashboard.view')

  const [orders, shipments, unpaidCharges, unpaidTaxes] = await Promise.all([
    db.importOrder.findMany({
      where: { stage: { in: ACTIVE_STAGES } },
      orderBy: { orderDate: 'asc' },
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
        shipments: {
          select: {
            reference: true,
            status: true,
            containerNumber: true,
            expectedArrival: true,
            actualArrival: true,
          },
        },
      },
    }),
    db.shipment.findMany({
      where: { status: { in: ['LOADED', 'DEPARTED', 'ARRIVED'] } },
      orderBy: [{ expectedArrival: 'asc' }],
      select: {
        id: true,
        reference: true,
        containerNumber: true,
        status: true,
        expectedArrival: true,
        actualArrival: true,
        numberOfBales: true,
        clearingAgent: { select: { name: true } },
        importOrder: { select: { id: true, reference: true } },
      },
    }),
    db.landedCostCharge.aggregate({
      where: { isPaid: false },
      _sum: { amountKes: true },
    }),
    db.customsEntry.aggregate({
      where: { paidAt: null },
      _sum: { totalTaxes: true },
    }),
  ])

  const goodsInPipeline = orders.reduce(
    (sum, order) => sum + toNumber(order.goodsValue) * toNumber(order.exchangeRate),
    0,
  )
  const chargesInPipeline = orders.reduce(
    (sum, order) => sum + order.charges.reduce((s, c) => s + toNumber(c.amountKes), 0),
    0,
  )

  const now = Date.now()

  return (
    <>
      <PageHeader
        breadcrumb="Dashboard"
        title="Import status"
        description="Every consignment between the factory in China and the warehouse."
        action={
          <Link href="/imports">
            <Button variant="secondary">Manage imports</Button>
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active imports"
          value={formatNumber(orders.length)}
          sublabel="orders not yet closed"
          tone="dark"
          icon={<Ship className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Goods in the pipeline"
          value={formatKes(goodsInPipeline)}
          sublabel="supplier value, converted to KES"
          tone="dark"
          icon={<Container className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Charges incurred"
          value={formatKes(chargesInPipeline)}
          sublabel="freight, clearing and taxes so far"
          tone="amber"
          icon={<Truck className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Outstanding to pay"
          value={formatKes(
            toNumber(unpaidCharges._sum.amountKes) + toNumber(unpaidTaxes._sum.totalTaxes),
          )}
          sublabel="unpaid charges and KRA taxes"
          tone="red"
          icon={<Anchor className="h-4 w-4" aria-hidden />}
        />
      </div>

      <div className="mb-5">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Containers on the water and at the port"
              description="Sorted by the date they are expected to arrive."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Shipment</TH>
                  <TH>Import order</TH>
                  <TH>Container</TH>
                  <TH>Agent</TH>
                  <TH>Expected</TH>
                  <TH align="right">Bales</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {shipments.length === 0 ? (
                  <EmptyRow colSpan={7} message="Nothing is currently in transit." />
                ) : (
                  shipments.map((shipment) => {
                    const overdue =
                      shipment.expectedArrival &&
                      !shipment.actualArrival &&
                      shipment.expectedArrival.getTime() < now

                    return (
                      <TR key={shipment.id}>
                        <TD>
                          <span className="tabular font-semibold text-saipei-dark-700">
                            {shipment.reference}
                          </span>
                        </TD>
                        <TD>
                          <Link
                            href={`/imports/${shipment.importOrder.id}`}
                            className="tabular text-saipei-dark-700 hover:underline"
                          >
                            {shipment.importOrder.reference}
                          </Link>
                        </TD>
                        <TD>
                          <span className="tabular">
                            {shipment.containerNumber ?? '—'}
                          </span>
                        </TD>
                        <TD>
                          {shipment.clearingAgent?.name ?? (
                            <span className="text-saipei-amber-700">Not appointed</span>
                          )}
                        </TD>
                        <TD>
                          {shipment.expectedArrival ? (
                            overdue ? (
                              <Badge tone="danger">
                                Overdue {formatDate(shipment.expectedArrival)}
                              </Badge>
                            ) : (
                              formatDate(shipment.expectedArrival)
                            )
                          ) : (
                            '—'
                          )}
                        </TD>
                        <TD align="right" numeric>
                          {formatNumber(shipment.numberOfBales)}
                        </TD>
                        <TD>
                          <StatusBadge status={shipment.status} />
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
            title="Active import orders"
            description="Oldest first — the ones that have been open longest."
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <THead>
              <TR>
                <TH>Reference</TH>
                <TH>Supplier</TH>
                <TH>Ordered</TH>
                <TH>Days open</TH>
                <TH align="right">Goods</TH>
                <TH align="right">Charges</TH>
                <TH>Stage</TH>
              </TR>
            </THead>
            <TBody>
              {orders.length === 0 ? (
                <EmptyRow colSpan={7} message="No active import orders." />
              ) : (
                orders.map((order) => {
                  const days = Math.floor(
                    (now - order.orderDate.getTime()) / (1000 * 60 * 60 * 24),
                  )
                  const charges = order.charges.reduce(
                    (sum, c) => sum + toNumber(c.amountKes),
                    0,
                  )

                  return (
                    <TR key={order.id}>
                      <TD>
                        <Link
                          href={`/imports/${order.id}`}
                          className="tabular font-semibold text-saipei-dark-700 hover:underline"
                        >
                          {order.reference}
                        </Link>
                      </TD>
                      <TD>{order.supplier.name}</TD>
                      <TD>{formatDate(order.orderDate)}</TD>
                      <TD>
                        <span
                          className={
                            'tabular ' +
                            (days > 120
                              ? 'font-semibold text-saipei-red-600'
                              : days > 60
                                ? 'text-saipei-amber-700'
                                : 'text-saipei-gray-600')
                          }
                        >
                          {formatNumber(days)}
                        </span>
                      </TD>
                      <TD align="right" numeric>
                        {formatKes(
                          toNumber(order.goodsValue) * toNumber(order.exchangeRate),
                        )}
                      </TD>
                      <TD align="right" numeric>
                        {formatKes(charges)}
                      </TD>
                      <TD>
                        <StatusBadge status={order.stage} />
                      </TD>
                    </TR>
                  )
                })
              )}
            </TBody>
          </table>
        </div>
      </Card>
    </>
  )
}
