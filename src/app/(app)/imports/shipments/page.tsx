import type { Metadata } from 'next'
import Link from 'next/link'
import { Anchor, Container, Ship } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { ListFilters } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, formatNumber, toNumber } from '@/lib/utils'
import { ShipmentForm } from './shipment-form'

export const metadata: Metadata = { title: 'Shipments' }
export const dynamic = 'force-dynamic'

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const user = await requirePermission('imports.view')
  const params = await searchParams

  const where: Record<string, unknown> = {}
  if (params.status) where.status = params.status
  if (params.q) {
    where.OR = [
      { reference: { contains: params.q } },
      { containerNumber: { contains: params.q } },
      { billOfLading: { contains: params.q } },
      { vesselName: { contains: params.q } },
    ]
  }

  const [shipments, orders, agents, counts] = await Promise.all([
    db.shipment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        reference: true,
        containerNumber: true,
        billOfLading: true,
        vesselName: true,
        loadingDate: true,
        departureDate: true,
        expectedArrival: true,
        actualArrival: true,
        status: true,
        numberOfBales: true,
        totalWeightKg: true,
        importOrder: { select: { id: true, reference: true, supplier: { select: { name: true } } } },
        clearingAgent: { select: { name: true } },
      },
    }),
    db.importOrder.findMany({
      where: { stage: { not: 'CLOSED' } },
      orderBy: { orderDate: 'desc' },
      select: { id: true, reference: true, supplier: { select: { name: true } } },
    }),
    db.clearingAgent.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    db.shipment.groupBy({ by: ['status'], _count: { _all: true } }),
  ])

  const countOf = (status: string) =>
    counts.find((row) => row.status === status)?._count._all ?? 0

  return (
    <>
      <PageHeader
        breadcrumb="Import & Clearing"
        title="Shipments"
        description="Containers from loading in China to release at Mombasa."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="At sea"
          value={formatNumber(countOf('DEPARTED'))}
          sublabel="departed, not yet arrived"
          tone="dark"
          icon={<Ship className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Arrived at port"
          value={formatNumber(countOf('ARRIVED'))}
          sublabel="waiting to be cleared"
          tone="amber"
          icon={<Anchor className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Cleared"
          value={formatNumber(countOf('CLEARED'))}
          sublabel="released from the customs station"
          tone="green"
        />
        <StatCard
          label="Delivered"
          value={formatNumber(countOf('DELIVERED'))}
          sublabel="received into the warehouse"
          tone="green"
          icon={<Container className="h-4 w-4" aria-hidden />}
        />
      </div>

      {user.permissions.includes('imports.manage') ? (
        <div className="mb-6">
          <ShipmentForm
            orders={orders.map((order) => ({
              id: order.id,
              reference: order.reference,
              supplierName: order.supplier.name,
            }))}
            agents={agents}
          />
        </div>
      ) : null}

      <ListFilters
        searchPlaceholder="Search by reference, container, BL or vessel…"
        selects={[
          {
            name: 'status',
            label: 'Status',
            options: [
              { value: 'PENDING', label: 'Pending' },
              { value: 'LOADED', label: 'Loaded' },
              { value: 'DEPARTED', label: 'Departed' },
              { value: 'ARRIVED', label: 'Arrived' },
              { value: 'CLEARED', label: 'Cleared' },
              { value: 'DELIVERED', label: 'Delivered' },
            ],
          },
        ]}
      />

      <Table>
        <THead>
          <TR>
            <TH>Shipment</TH>
            <TH>Import order</TH>
            <TH>Container</TH>
            <TH>Vessel / BL</TH>
            <TH>Loaded</TH>
            <TH>Arrival</TH>
            <TH align="right">Bales</TH>
            <TH align="right">Weight (kg)</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {shipments.length === 0 ? (
            <EmptyRow colSpan={9} message="No shipments match these filters." />
          ) : (
            shipments.map((shipment) => (
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
                  <Link
                    href={`/imports/${shipment.importOrder.id}`}
                    className="tabular text-saipei-dark-700 hover:underline"
                  >
                    {shipment.importOrder.reference}
                  </Link>
                  <span className="block text-xs text-saipei-gray-500">
                    {shipment.importOrder.supplier.name}
                  </span>
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
                <TD>{shipment.loadingDate ? formatDate(shipment.loadingDate) : '—'}</TD>
                <TD>
                  {shipment.actualArrival ? (
                    formatDate(shipment.actualArrival)
                  ) : shipment.expectedArrival ? (
                    <span className="text-saipei-gray-500">
                      exp. {formatDate(shipment.expectedArrival)}
                    </span>
                  ) : (
                    '—'
                  )}
                </TD>
                <TD align="right" numeric>
                  {formatNumber(shipment.numberOfBales)}
                </TD>
                <TD align="right" numeric>
                  {formatNumber(toNumber(shipment.totalWeightKg), 2)}
                </TD>
                <TD>
                  <StatusBadge status={shipment.status} />
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
    </>
  )
}
