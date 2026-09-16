import type { Metadata } from 'next'
import Link from 'next/link'
import { Files } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { ListFilters } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, formatNumber, humanize } from '@/lib/utils'
import { DocumentForm } from './document-form'

export const metadata: Metadata = { title: 'Import documents' }
export const dynamic = 'force-dynamic'

const DOC_TYPES = [
  'IDF',
  'CUSTOMS_DECLARATION',
  'ACA_PERMIT',
  'UCR',
  'BILL_OF_LADING',
  'PACKING_LIST',
  'COMMERCIAL_INVOICE',
  'PVOC_KEBS',
  'FUMIGATION_CERT',
  'HEALTH_CERT',
  'RELEASE_ORDER',
  'OTHER',
]

export default async function ImportDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const user = await requirePermission('imports.view')
  const params = await searchParams

  const where: Record<string, unknown> = {}
  if (params.type) where.type = params.type
  if (params.q) {
    where.OR = [
      { reference: { contains: params.q } },
      { importOrder: { reference: { contains: params.q } } },
    ]
  }

  const [documents, orders, shipments, byType] = await Promise.all([
    db.importDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        importOrder: {
          select: { id: true, reference: true, supplier: { select: { name: true } } },
        },
        shipment: { select: { reference: true, containerNumber: true } },
      },
    }),
    db.importOrder.findMany({
      where: { stage: { not: 'CLOSED' } },
      orderBy: { orderDate: 'desc' },
      select: { id: true, reference: true, supplier: { select: { name: true } } },
    }),
    db.shipment.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, reference: true, importOrderId: true, containerNumber: true },
    }),
    db.importDocument.groupBy({ by: ['type'], _count: { _all: true } }),
  ])

  const now = Date.now()
  const expiringSoon = documents.filter(
    (doc) =>
      doc.expiryDate &&
      doc.expiryDate.getTime() > now &&
      doc.expiryDate.getTime() - now < 30 * 24 * 60 * 60 * 1000,
  ).length
  const expired = documents.filter(
    (doc) => doc.expiryDate && doc.expiryDate.getTime() <= now,
  ).length

  return (
    <>
      <PageHeader
        breadcrumb="Import & Clearing"
        title="Import documents"
        description="IDF, UCR, ACA permits, bills of lading, PVOC and certificates."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Documents on file"
          value={formatNumber(byType.reduce((sum, row) => sum + row._count._all, 0))}
          sublabel={`${byType.length} different types`}
          tone="dark"
          icon={<Files className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Expiring within 30 days"
          value={formatNumber(expiringSoon)}
          sublabel="renew before they lapse"
          tone="amber"
        />
        <StatCard
          label="Expired"
          value={formatNumber(expired)}
          sublabel="no longer valid"
          tone={expired > 0 ? 'red' : 'green'}
        />
      </div>

      {user.permissions.includes('imports.manage') ? (
        <div className="mb-6">
          <DocumentForm
            orders={orders.map((order) => ({
              id: order.id,
              label: `${order.reference} — ${order.supplier.name}`,
            }))}
            shipments={shipments.map((s) => ({
              id: s.id,
              importOrderId: s.importOrderId,
              label: `${s.reference}${s.containerNumber ? ` (${s.containerNumber})` : ''}`,
            }))}
          />
        </div>
      ) : null}

      <ListFilters
        searchPlaceholder="Search by document or import reference…"
        selects={[
          {
            name: 'type',
            label: 'Type',
            options: DOC_TYPES.map((type) => ({ value: type, label: humanize(type) })),
          },
        ]}
      />

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <THead>
              <TR>
                <TH>Type</TH>
                <TH>Reference</TH>
                <TH>Import order</TH>
                <TH>Shipment</TH>
                <TH>Issued</TH>
                <TH>Expires</TH>
                <TH>Notes</TH>
              </TR>
            </THead>
            <TBody>
              {documents.length === 0 ? (
                <EmptyRow colSpan={7} message="No documents match these filters." />
              ) : (
                documents.map((doc) => {
                  const expired = doc.expiryDate && doc.expiryDate.getTime() <= now
                  return (
                    <TR key={doc.id}>
                      <TD>
                        <span className="font-semibold text-saipei-dark-800">
                          {humanize(doc.type)}
                        </span>
                      </TD>
                      <TD>
                        <span className="tabular">{doc.reference ?? '—'}</span>
                      </TD>
                      <TD>
                        <Link
                          href={`/imports/${doc.importOrder.id}`}
                          className="tabular text-saipei-dark-700 hover:underline"
                        >
                          {doc.importOrder.reference}
                        </Link>
                        <span className="block text-xs text-saipei-gray-500">
                          {doc.importOrder.supplier.name}
                        </span>
                      </TD>
                      <TD>
                        <span className="tabular">{doc.shipment?.reference ?? '—'}</span>
                      </TD>
                      <TD>{doc.issueDate ? formatDate(doc.issueDate) : '—'}</TD>
                      <TD>
                        {doc.expiryDate ? (
                          expired ? (
                            <Badge tone="danger">Expired {formatDate(doc.expiryDate)}</Badge>
                          ) : (
                            formatDate(doc.expiryDate)
                          )
                        ) : (
                          '—'
                        )}
                      </TD>
                      <TD>
                        <span className="text-saipei-gray-600">{doc.notes ?? '—'}</span>
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
