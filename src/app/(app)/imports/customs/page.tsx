import type { Metadata } from 'next'
import Link from 'next/link'
import { BadgeCheck, Landmark } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, formatKes, formatNumber, toNumber } from '@/lib/utils'
import { CustomsEntryForm } from './customs-form'

export const metadata: Metadata = { title: 'Customs & taxes' }
export const dynamic = 'force-dynamic'

export default async function CustomsPage() {
  const user = await requirePermission('imports.view')

  const [entries, shipments] = await Promise.all([
    db.customsEntry.findMany({
      orderBy: { entryDate: 'desc' },
      take: 30,
      include: {
        shipment: {
          select: {
            reference: true,
            containerNumber: true,
            importOrder: { select: { id: true, reference: true } },
          },
        },
      },
    }),
    db.shipment.findMany({
      where: { status: { in: ['DEPARTED', 'ARRIVED', 'CLEARED'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        reference: true,
        containerNumber: true,
        importOrder: { select: { reference: true } },
      },
    }),
  ])

  const totalTaxes = entries.reduce((sum, e) => sum + toNumber(e.totalTaxes), 0)
  const unpaid = entries
    .filter((e) => !e.paidAt)
    .reduce((sum, e) => sum + toNumber(e.totalTaxes), 0)
  const totalDuty = entries.reduce((sum, e) => sum + toNumber(e.importDuty), 0)
  const totalVat = entries.reduce((sum, e) => sum + toNumber(e.vat), 0)

  return (
    <>
      <PageHeader
        breadcrumb="Import & Clearing"
        title="Customs & taxes"
        description="KRA entries, duty, VAT and the levies that apply to each consignment."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Taxes declared"
          value={formatKes(totalTaxes)}
          sublabel={`across ${formatNumber(entries.length)} entries`}
          tone="dark"
          icon={<Landmark className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Import duty"
          value={formatKes(totalDuty)}
          sublabel="customs duty component"
          tone="dark"
        />
        <StatCard
          label="VAT"
          value={formatKes(totalVat)}
          sublabel="import VAT component"
          tone="dark"
        />
        <StatCard
          label="Outstanding"
          value={formatKes(unpaid)}
          sublabel="entries not yet paid"
          tone={unpaid > 0 ? 'red' : 'green'}
          icon={<BadgeCheck className="h-4 w-4" aria-hidden />}
        />
      </div>

      {user.permissions.includes('imports.costs') ? (
        <div className="mb-6">
          <CustomsEntryForm
            shipments={shipments.map((s) => ({
              id: s.id,
              label: `${s.reference} — ${s.importOrder.reference}${s.containerNumber ? ` (${s.containerNumber})` : ''}`,
            }))}
          />
        </div>
      ) : null}

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader title="Customs entries" description="The last thirty declarations." />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <THead>
              <TR>
                <TH>Entry no.</TH>
                <TH>Shipment</TH>
                <TH>Date</TH>
                <TH align="right">Customs value</TH>
                <TH align="right">Duty</TH>
                <TH align="right">VAT</TH>
                <TH align="right">Levies</TH>
                <TH align="right">Total taxes</TH>
                <TH>Paid</TH>
              </TR>
            </THead>
            <TBody>
              {entries.length === 0 ? (
                <EmptyRow colSpan={9} message="No customs entries captured yet." />
              ) : (
                entries.map((entry) => {
                  const levies =
                    toNumber(entry.idfFee) +
                    toNumber(entry.railwayLevy) +
                    toNumber(entry.importDeclLevy) +
                    toNumber(entry.exciseDuty) +
                    toNumber(entry.otherLevies)

                  return (
                    <TR key={entry.id}>
                      <TD>
                        <span className="tabular font-semibold text-saipei-dark-700">
                          {entry.entryNumber}
                        </span>
                      </TD>
                      <TD>
                        <Link
                          href={`/imports/${entry.shipment.importOrder.id}`}
                          className="tabular text-saipei-dark-700 hover:underline"
                        >
                          {entry.shipment.reference}
                        </Link>
                        {entry.shipment.containerNumber ? (
                          <span className="tabular block text-xs text-saipei-gray-500">
                            {entry.shipment.containerNumber}
                          </span>
                        ) : null}
                      </TD>
                      <TD>{formatDate(entry.entryDate)}</TD>
                      <TD align="right" numeric>
                        {formatKes(entry.customsValue)}
                      </TD>
                      <TD align="right" numeric>
                        {formatKes(entry.importDuty)}
                      </TD>
                      <TD align="right" numeric>
                        {formatKes(entry.vat)}
                      </TD>
                      <TD align="right" numeric>
                        {formatKes(levies)}
                      </TD>
                      <TD align="right" numeric>
                        <span className="font-bold text-saipei-dark-800">
                          {formatKes(entry.totalTaxes)}
                        </span>
                      </TD>
                      <TD>
                        {entry.paidAt ? (
                          <Badge tone="success">Paid {formatDate(entry.paidAt)}</Badge>
                        ) : (
                          <Badge tone="danger">Unpaid</Badge>
                        )}
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
