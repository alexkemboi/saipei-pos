import type { Metadata } from 'next'
import Link from 'next/link'
import { Anchor, FileWarning } from 'lucide-react'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'
import { ClearingActions } from './clearing-actions'

export const metadata: Metadata = { title: 'Clearing' }
export const dynamic = 'force-dynamic'

/** Documents the clearing agent needs before a container can be released. */
const REQUIRED_DOCS = [
  'IDF',
  'BILL_OF_LADING',
  'COMMERCIAL_INVOICE',
  'PACKING_LIST',
  'PVOC_KEBS',
  'CUSTOMS_DECLARATION',
]

export default async function ClearingPage() {
  const user = await requirePermission('imports.view')

  const shipments = await db.shipment.findMany({
    where: { status: { in: ['DEPARTED', 'ARRIVED', 'CLEARED'] } },
    orderBy: [{ actualArrival: 'asc' }, { expectedArrival: 'asc' }],
    select: {
      id: true,
      reference: true,
      containerNumber: true,
      status: true,
      expectedArrival: true,
      actualArrival: true,
      agentNotifiedAt: true,
      releasedAt: true,
      clearingAgent: { select: { name: true, phone: true } },
      importOrder: {
        select: {
          id: true,
          reference: true,
          supplier: { select: { name: true } },
          documents: { select: { type: true } },
        },
      },
      customsEntries: { select: { entryNumber: true, totalTaxes: true, paidAt: true } },
      charges: { select: { amountKes: true, isPaid: true } },
    },
  })

  const awaitingClearance = shipments.filter((s) => s.status === 'ARRIVED').length
  const unpaidTaxes = shipments.reduce(
    (sum, s) =>
      sum +
      s.customsEntries
        .filter((entry) => !entry.paidAt)
        .reduce((total, entry) => total + toNumber(entry.totalTaxes), 0),
    0,
  )
  const unpaidCharges = shipments.reduce(
    (sum, s) =>
      sum +
      s.charges.filter((c) => !c.isPaid).reduce((t, c) => t + toNumber(c.amountKes), 0),
    0,
  )

  return (
    <>
      <PageHeader
        breadcrumb="Import & Clearing"
        title="Clearing"
        description="What each container still needs before it can leave the port."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Awaiting clearance"
          value={formatNumber(awaitingClearance)}
          sublabel="arrived but not yet released"
          tone="amber"
          icon={<Anchor className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Taxes outstanding"
          value={formatKes(unpaidTaxes)}
          sublabel="KRA entries not yet paid"
          tone="red"
        />
        <StatCard
          label="Charges outstanding"
          value={formatKes(unpaidCharges)}
          sublabel="agent, port and transport"
          tone="red"
        />
      </div>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Containers in clearing"
            description="Missing documents are listed so the agent can be chased for them."
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <THead>
              <TR>
                <TH>Shipment</TH>
                <TH>Import order</TH>
                <TH>Agent</TH>
                <TH>Arrival</TH>
                <TH>Customs entry</TH>
                <TH>Documents outstanding</TH>
                <TH>Status</TH>
                {user.permissions.includes('imports.manage') ? <TH>Action</TH> : null}
              </TR>
            </THead>
            <TBody>
              {shipments.length === 0 ? (
                <EmptyRow colSpan={8} message="Nothing is currently in clearing." />
              ) : (
                shipments.map((shipment) => {
                  const held = new Set(
                    shipment.importOrder.documents.map((doc) => doc.type),
                  )
                  const missing = REQUIRED_DOCS.filter((doc) => !held.has(doc))
                  const entry = shipment.customsEntries[0]

                  return (
                    <TR key={shipment.id}>
                      <TD>
                        <span className="tabular font-semibold text-saipei-dark-700">
                          {shipment.reference}
                        </span>
                        {shipment.containerNumber ? (
                          <span className="tabular block text-xs text-saipei-gray-500">
                            {shipment.containerNumber}
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
                        {shipment.clearingAgent?.name ?? (
                          <span className="text-saipei-amber-700">Not appointed</span>
                        )}
                        {shipment.clearingAgent?.phone ? (
                          <span className="tabular block text-xs text-saipei-gray-500">
                            {shipment.clearingAgent.phone}
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
                      <TD>
                        {entry ? (
                          <>
                            <span className="tabular">{entry.entryNumber}</span>
                            <span className="block text-xs">
                              {entry.paidAt ? (
                                <span className="text-saipei-green-700">
                                  taxes paid
                                </span>
                              ) : (
                                <span className="text-saipei-red-600">
                                  {formatKes(entry.totalTaxes)} due
                                </span>
                              )}
                            </span>
                          </>
                        ) : (
                          <span className="text-saipei-amber-700">Not declared</span>
                        )}
                      </TD>
                      <TD>
                        {missing.length === 0 ? (
                          <Badge tone="success">All documents held</Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {missing.map((doc) => (
                              <Badge
                                key={doc}
                                tone="warning"
                                icon={<FileWarning className="h-3.5 w-3.5" aria-hidden />}
                              >
                                {humanize(doc)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TD>
                      <TD>
                        <StatusBadge status={shipment.status} />
                      </TD>
                      {user.permissions.includes('imports.manage') ? (
                        <TD>
                          <ClearingActions
                            shipmentId={shipment.id}
                            status={shipment.status}
                          />
                        </TD>
                      ) : null}
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
