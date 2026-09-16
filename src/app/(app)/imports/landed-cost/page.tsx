import type { Metadata } from 'next'
import Link from 'next/link'
import { Truck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { ListFilters } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'
import { ChargeForm } from './charge-form'

export const metadata: Metadata = { title: 'Landed cost' }
export const dynamic = 'force-dynamic'

const CATEGORIES = [
  'FREIGHT',
  'CLEARING_AGENT_FEE',
  'CUSTOMS_TAXES',
  'PORT_CFS',
  'SHIPPING',
  'TRANSPORT',
  'OFFLOADING',
  'WAREHOUSE',
  'INSPECTION',
  'ACA_PAYMENT',
  'FUMIGATION',
  'OTHER',
]

export default async function LandedCostPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const user = await requirePermission('imports.view')
  const params = await searchParams

  const where: Record<string, unknown> = {}
  if (params.category) where.category = params.category
  if (params.importOrderId) where.importOrderId = params.importOrderId
  if (params.paid === 'yes') where.isPaid = true
  if (params.paid === 'no') where.isPaid = false

  const [charges, orders, shipments, byCategory] = await Promise.all([
    db.landedCostCharge.findMany({
      where,
      orderBy: { chargeDate: 'desc' },
      take: 100,
      include: {
        importOrder: { select: { id: true, reference: true } },
        shipment: { select: { reference: true, containerNumber: true } },
      },
    }),
    db.importOrder.findMany({
      orderBy: { orderDate: 'desc' },
      select: { id: true, reference: true, supplier: { select: { name: true } } },
    }),
    db.shipment.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, reference: true, importOrderId: true, containerNumber: true },
    }),
    db.landedCostCharge.groupBy({ by: ['category'], _sum: { amountKes: true } }),
  ])

  const total = charges.reduce((sum, c) => sum + toNumber(c.amountKes), 0)
  const unpaid = charges
    .filter((c) => !c.isPaid)
    .reduce((sum, c) => sum + toNumber(c.amountKes), 0)

  const topCategories = byCategory
    .map((row) => ({ category: row.category, amount: toNumber(row._sum.amountKes) }))
    .sort((a, b) => b.amount - a.amount)

  return (
    <>
      <PageHeader
        breadcrumb="Import & Clearing"
        title="Landed cost"
        description="Freight, agent fees, port and transport charges that build the true cost of goods."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Charges shown"
          value={formatKes(total)}
          sublabel={`${formatNumber(charges.length)} charges`}
          tone="dark"
          icon={<Truck className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Unpaid"
          value={formatKes(unpaid)}
          sublabel="still owed to agents and carriers"
          tone={unpaid > 0 ? 'red' : 'green'}
        />
        <StatCard
          label="Largest category"
          value={topCategories[0] ? humanize(topCategories[0].category) : '—'}
          sublabel={topCategories[0] ? formatKes(topCategories[0].amount) : 'no charges yet'}
          tone="amber"
        />
      </div>

      {user.permissions.includes('imports.costs') ? (
        <div className="mb-6">
          <ChargeForm
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

      <div className="mb-5">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Cost by category" description="Across every import order." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Category</TH>
                  <TH align="right">Total (KES)</TH>
                  <TH align="right">Share</TH>
                </TR>
              </THead>
              <TBody>
                {topCategories.length === 0 ? (
                  <EmptyRow colSpan={3} message="No charges recorded yet." />
                ) : (
                  topCategories.map((row) => {
                    const grand = topCategories.reduce((sum, r) => sum + r.amount, 0)
                    const share = grand > 0 ? (row.amount / grand) * 100 : 0
                    return (
                      <TR key={row.category}>
                        <TD>
                          <span className="font-medium text-saipei-dark-800">
                            {humanize(row.category)}
                          </span>
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

      <ListFilters
        showSearch={false}
        selects={[
          {
            name: 'category',
            label: 'Category',
            options: CATEGORIES.map((c) => ({ value: c, label: humanize(c) })),
          },
          {
            name: 'importOrderId',
            label: 'Import order',
            options: orders.map((o) => ({ value: o.id, label: o.reference })),
          },
          {
            name: 'paid',
            label: 'Settled',
            options: [
              { value: 'yes', label: 'Paid' },
              { value: 'no', label: 'Unpaid' },
            ],
          },
        ]}
      />

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Import order</TH>
                <TH>Shipment</TH>
                <TH>Category</TH>
                <TH>Description</TH>
                <TH>Payee</TH>
                <TH align="right">Amount</TH>
                <TH align="right">KES</TH>
                <TH>Settled</TH>
              </TR>
            </THead>
            <TBody>
              {charges.length === 0 ? (
                <EmptyRow colSpan={9} message="No charges match these filters." />
              ) : (
                charges.map((charge) => (
                  <TR key={charge.id}>
                    <TD>{formatDate(charge.chargeDate)}</TD>
                    <TD>
                      <Link
                        href={`/imports/${charge.importOrder.id}`}
                        className="tabular text-saipei-dark-700 hover:underline"
                      >
                        {charge.importOrder.reference}
                      </Link>
                    </TD>
                    <TD>
                      <span className="tabular">{charge.shipment?.reference ?? '—'}</span>
                    </TD>
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
                      {charge.isPaid ? (
                        <Badge tone="success">Paid</Badge>
                      ) : (
                        <Badge tone="warning">Unpaid</Badge>
                      )}
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
