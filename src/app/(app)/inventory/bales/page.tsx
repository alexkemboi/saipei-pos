import type { Metadata } from 'next'
import { Container, Scale, Weight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ListFilters, Pagination } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, formatKes, formatNumber, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Bales' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function BalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requirePermission('inventory.view')
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const where: Record<string, unknown> = {}
  if (params.warehouseId) where.warehouseId = params.warehouseId
  if (params.opened === 'yes') where.isOpened = true
  if (params.opened === 'no') where.isOpened = false
  if (params.q) {
    where.OR = [
      { baleNumber: { contains: params.q } },
      { shoeType: { contains: params.q } },
      { goodsReceipt: { containerNumber: { contains: params.q } } },
    ]
  }

  const [rows, total, aggregate, warehouses] = await Promise.all([
    db.bale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        baleNumber: true,
        shoeType: true,
        weightKg: true,
        balePrice: true,
        landedCost: true,
        piecesEstimate: true,
        piecesSold: true,
        isOpened: true,
        createdAt: true,
        warehouse: { select: { name: true, code: true } },
        product: { select: { sku: true, name: true } },
        goodsReceipt: { select: { reference: true, containerNumber: true } },
      },
    }),
    db.bale.count({ where }),
    db.bale.aggregate({
      where,
      _sum: { weightKg: true, landedCost: true, piecesEstimate: true },
    }),
    db.warehouse.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  const totalPieces = toNumber(aggregate._sum.piecesEstimate)
  const totalLanded = toNumber(aggregate._sum.landedCost)

  return (
    <>
      <PageHeader
        breadcrumb="Warehousing & Inventory"
        title="Bales"
        description="Every bale received, its weight, type of shoes and landed cost."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Bales"
          value={formatNumber(total)}
          sublabel="matching the current filters"
          tone="dark"
          icon={<Container className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Total weight"
          value={`${formatNumber(toNumber(aggregate._sum.weightKg), 2)} kg`}
          sublabel="as weighed on arrival"
          tone="dark"
          icon={<Weight className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Landed cost"
          value={formatKes(totalLanded)}
          sublabel="bale price plus arrival charges"
          tone="green"
          icon={<Scale className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Cost per piece"
          value={totalPieces > 0 ? formatKes(totalLanded / totalPieces) : '—'}
          sublabel={`${formatNumber(totalPieces)} estimated pieces`}
          tone="green"
        />
      </div>

      <ListFilters
        searchPlaceholder="Search by bale number, shoe type or container…"
        selects={[
          {
            name: 'warehouseId',
            label: 'Warehouse',
            options: warehouses.map((w) => ({ value: w.id, label: w.name })),
          },
          {
            name: 'opened',
            label: 'Condition',
            options: [
              { value: 'no', label: 'Sealed' },
              { value: 'yes', label: 'Opened' },
            ],
          },
        ]}
      />

      <Table>
        <THead>
          <TR>
            <TH>Bale no.</TH>
            <TH>Type of shoes</TH>
            <TH>GRN / container</TH>
            <TH>Warehouse</TH>
            <TH align="right">Weight (kg)</TH>
            <TH align="right">Bale price</TH>
            <TH align="right">Landed cost</TH>
            <TH align="right">Pieces</TH>
            <TH>Condition</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={9} message="No bales match these filters." />
          ) : (
            rows.map((bale) => (
              <TR key={bale.id}>
                <TD>
                  <span className="tabular font-semibold text-saipei-dark-700">
                    {bale.baleNumber}
                  </span>
                  <span className="block text-xs text-saipei-gray-400">
                    {formatDate(bale.createdAt)}
                  </span>
                </TD>
                <TD>
                  <span className="font-medium text-saipei-dark-800">{bale.shoeType}</span>
                  {bale.product ? (
                    <span className="tabular block text-xs text-saipei-gray-500">
                      {bale.product.sku}
                    </span>
                  ) : (
                    <span className="block text-xs text-saipei-amber-700">
                      not linked to a stock item
                    </span>
                  )}
                </TD>
                <TD>
                  <span className="tabular text-saipei-gray-600">
                    {bale.goodsReceipt.reference}
                  </span>
                  {bale.goodsReceipt.containerNumber ? (
                    <span className="tabular block text-xs text-saipei-gray-400">
                      {bale.goodsReceipt.containerNumber}
                    </span>
                  ) : null}
                </TD>
                <TD>{bale.warehouse.name}</TD>
                <TD align="right" numeric>
                  {formatNumber(bale.weightKg, 2)}
                </TD>
                <TD align="right" numeric>
                  {formatKes(bale.balePrice)}
                </TD>
                <TD align="right" numeric>
                  {formatKes(bale.landedCost)}
                </TD>
                <TD align="right" numeric>
                  {formatNumber(bale.piecesSold)} / {formatNumber(bale.piecesEstimate)}
                </TD>
                <TD>
                  {bale.isOpened ? (
                    <Badge tone="warning">Opened</Badge>
                  ) : (
                    <Badge tone="success">Sealed</Badge>
                  )}
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <Pagination
        page={page}
        pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        total={total}
      />
    </>
  )
}
