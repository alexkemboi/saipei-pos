import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Container, FileText, Ship, Truck } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'
import { StageStepper } from './stage-stepper'

export const metadata: Metadata = { title: 'Import order' }
export const dynamic = 'force-dynamic'

export default async function ImportOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requirePermission('imports.view')
  const { id } = await params

  const order = await db.importOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      shipments: {
        orderBy: { createdAt: 'asc' },
        include: {
          clearingAgent: { select: { name: true } },
          customsEntries: true,
          goodsReceipts: { select: { id: true, reference: true } },
        },
      },
      documents: { orderBy: { createdAt: 'desc' } },
      charges: { orderBy: { chargeDate: 'desc' } },
    },
  })

  if (!order) notFound()

  const goodsKes = toNumber(order.goodsValue) * toNumber(order.exchangeRate)
  const chargesKes = order.charges.reduce((sum, c) => sum + toNumber(c.amountKes), 0)
  const landedTotal = goodsKes + chargesKes
  const unpaidCharges = order.charges
    .filter((c) => !c.isPaid)
    .reduce((sum, c) => sum + toNumber(c.amountKes), 0)

  const totalBales = order.shipments.reduce((sum, s) => sum + s.numberOfBales, 0)

  return (
    <>
      <PageHeader
        breadcrumb={`Import & Clearing · ${order.reference}`}
        title={order.description || order.reference}
        description={`${order.supplier.name}${order.supplier.country ? ` · ${order.supplier.country}` : ''} · ordered ${formatDate(order.orderDate)}`}
        action={
          <Link href="/imports">
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" aria-hidden />}>
              Back
            </Button>
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Goods value"
          value={formatKes(goodsKes)}
          sublabel={`${order.currency} ${formatNumber(order.goodsValue, 2)} @ ${formatNumber(order.exchangeRate, 2)}`}
          tone="dark"
          icon={<Container className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Import charges"
          value={formatKes(chargesKes)}
          sublabel="freight, clearing, taxes and transport"
          tone="red"
          icon={<Truck className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Total landed cost"
          value={formatKes(landedTotal)}
          sublabel={
            totalBales > 0
              ? `${formatKes(landedTotal / totalBales)} per bale`
              : 'no bales recorded yet'
          }
          tone="green"
        />
        <StatCard
          label="Unpaid charges"
          value={formatKes(unpaidCharges)}
          sublabel="still to be settled"
          tone={unpaidCharges > 0 ? 'amber' : 'green'}
        />
      </div>

      <div className="mb-5">
        <Card>
          <CardHeader
            title="Progress"
            description="Where this consignment sits in the import and clearing flow."
          />
          <StageStepper
            importOrderId={order.id}
            stage={order.stage}
            canEdit={user.permissions.includes('imports.manage')}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* --- Shipments --- */}
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Shipments"
              description="Containers moving under this order."
              action={
                <Link href="/imports/shipments">
                  <Button variant="ghost" size="sm" icon={<Ship className="h-4 w-4" aria-hidden />}>
                    Manage
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
                  <TH>Container</TH>
                  <TH>Vessel / BL</TH>
                  <TH>Arrival</TH>
                  <TH align="right">Bales</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {order.shipments.length === 0 ? (
                  <EmptyRow colSpan={6} message="No shipment has been raised yet." />
                ) : (
                  order.shipments.map((shipment) => (
                    <TR key={shipment.id}>
                      <TD>
                        <span className="tabular font-semibold text-saipei-dark-700">
                          {shipment.reference}
                        </span>
                        {shipment.clearingAgent ? (
                          <span className="block text-xs text-saipei-gray-500">
                            {shipment.clearingAgent.name}
                          </span>
                        ) : null}
                      </TD>
                      <TD>
                        <span className="tabular">{shipment.containerNumber ?? '—'}</span>
                      </TD>
                      <TD>
                        {shipment.vesselName ?? '—'}
                        {shipment.billOfLading ? (
                          <span className="tabular block text-xs text-saipei-gray-500">
                            BL {shipment.billOfLading}
                          </span>
                        ) : null}
                      </TD>
                      <TD>
                        {shipment.actualArrival
                          ? formatDate(shipment.actualArrival)
                          : shipment.expectedArrival
                            ? `exp. ${formatDate(shipment.expectedArrival)}`
                            : '—'}
                      </TD>
                      <TD align="right" numeric>
                        {formatNumber(shipment.numberOfBales)}
                      </TD>
                      <TD>
                        <StatusBadge status={shipment.status} />
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </table>
          </div>
        </Card>

        {/* --- Documents --- */}
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Documents"
              description="IDF, UCR, permits, bill of lading and certificates."
              action={
                <Link href="/imports/documents">
                  <Button variant="ghost" size="sm" icon={<FileText className="h-4 w-4" aria-hidden />}>
                    Manage
                  </Button>
                </Link>
              }
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Type</TH>
                  <TH>Reference</TH>
                  <TH>Issued</TH>
                  <TH>Expires</TH>
                </TR>
              </THead>
              <TBody>
                {order.documents.length === 0 ? (
                  <EmptyRow colSpan={4} message="No documents captured yet." />
                ) : (
                  order.documents.map((document) => (
                    <TR key={document.id}>
                      <TD>
                        <span className="font-medium text-saipei-dark-800">
                          {humanize(document.type)}
                        </span>
                      </TD>
                      <TD>
                        <span className="tabular">{document.reference ?? '—'}</span>
                      </TD>
                      <TD>{document.issueDate ? formatDate(document.issueDate) : '—'}</TD>
                      <TD>{document.expiryDate ? formatDate(document.expiryDate) : '—'}</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </table>
          </div>
        </Card>
      </div>

      {/* --- Landed cost --- */}
      <div className="mt-5">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Landed cost build-up"
              description="Every charge that adds to what this consignment cost to land."
              action={
                <Link href="/imports/landed-cost">
                  <Button variant="ghost" size="sm">
                    Add a charge
                  </Button>
                </Link>
              }
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Category</TH>
                  <TH>Description</TH>
                  <TH>Payee</TH>
                  <TH align="right">Amount</TH>
                  <TH align="right">KES</TH>
                  <TH>Paid</TH>
                </TR>
              </THead>
              <TBody>
                <TR className="bg-saipei-gray-50">
                  <TD>{formatDate(order.orderDate)}</TD>
                  <TD>
                    <span className="font-medium text-saipei-dark-800">Goods</span>
                  </TD>
                  <TD>Supplier invoice value</TD>
                  <TD>{order.supplier.name}</TD>
                  <TD align="right" numeric>
                    {order.currency} {formatNumber(order.goodsValue, 2)}
                  </TD>
                  <TD align="right" numeric>
                    {formatKes(goodsKes)}
                  </TD>
                  <TD>—</TD>
                </TR>
                {order.charges.map((charge) => (
                  <TR key={charge.id}>
                    <TD>{formatDate(charge.chargeDate)}</TD>
                    <TD>{humanize(charge.category)}</TD>
                    <TD>{charge.description}</TD>
                    <TD>{charge.payeeName ?? '—'}</TD>
                    <TD align="right" numeric>
                      {charge.currency} {formatNumber(charge.amount, 2)}
                    </TD>
                    <TD align="right" numeric>
                      {formatKes(charge.amountKes)}
                    </TD>
                    <TD>
                      <StatusBadge status={charge.isPaid ? 'PAID' : 'UNPAID'} />
                    </TD>
                  </TR>
                ))}
                <TR className="border-t-2 border-saipei-dark-700 bg-saipei-gray-50">
                  <TD colSpan={5}>
                    <span className="font-bold text-saipei-dark-800">Total landed cost</span>
                  </TD>
                  <TD align="right" numeric>
                    <span className="font-bold text-saipei-dark-800">
                      {formatKes(landedTotal)}
                    </span>
                  </TD>
                  <TD />
                </TR>
              </TBody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}
