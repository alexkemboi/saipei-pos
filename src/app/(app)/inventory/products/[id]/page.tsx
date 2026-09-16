import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Pencil } from 'lucide-react'
import { StockBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDateTime, formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Product' }
export const dynamic = 'force-dynamic'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requirePermission('inventory.view')
  const { id } = await params

  const product = await db.product.findUnique({
    where: { id },
    include: {
      category: true,
      stockLevels: { include: { warehouse: { select: { name: true, code: true } } } },
      movements: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          warehouse: { select: { code: true } },
          user: { select: { fullName: true } },
        },
      },
    },
  })

  if (!product) notFound()

  const quantity = product.stockLevels.reduce(
    (sum, level) => sum + toNumber(level.quantity),
    0,
  )
  const cost = toNumber(product.costPrice)
  const price = toNumber(product.sellingPrice)
  const reorderLevel = toNumber(product.reorderLevel)

  return (
    <>
      <PageHeader
        breadcrumb={`Warehousing & Inventory · Products · ${product.sku}`}
        title={product.name}
        description={product.category?.name ?? 'Uncategorised'}
        action={
          <>
            <Link href="/inventory/products">
              <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" aria-hidden />}>
                Back
              </Button>
            </Link>
            {user.permissions.includes('products.manage') ? (
              <Link href={`/inventory/products/${product.id}/edit`}>
                <Button variant="secondary" icon={<Pencil className="h-4 w-4" aria-hidden />}>
                  Edit
                </Button>
              </Link>
            ) : null}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="On hand"
          value={`${formatNumber(quantity)} ${humanize(product.unit).toLowerCase()}`}
          sublabel={`reorder at ${formatNumber(reorderLevel)}`}
          tone={quantity <= 0 ? 'red' : quantity <= reorderLevel ? 'amber' : 'green'}
        />
        <StatCard
          label="Stock value"
          value={formatKes(quantity * cost)}
          sublabel="at weighted average cost"
          tone="dark"
        />
        <StatCard label="Selling price" value={formatKes(price)} sublabel="VAT inclusive" tone="green" />
        <StatCard
          label="Margin"
          value={`${price > 0 ? (((price - cost) / price) * 100).toFixed(1) : '0.0'}%`}
          sublabel={`${formatKes(price - cost)} per unit`}
          tone="green"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.6fr]">
        <Card padded={false} className="self-start">
          <div className="px-5 pt-5">
            <CardHeader title="Stock by warehouse" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Warehouse</TH>
                  <TH align="right">Quantity</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {product.stockLevels.length === 0 ? (
                  <EmptyRow colSpan={3} message="This product has never been received." />
                ) : (
                  product.stockLevels.map((level) => (
                    <TR key={level.id}>
                      <TD>
                        <span className="font-medium text-saipei-dark-800">
                          {level.warehouse.name}
                        </span>
                      </TD>
                      <TD align="right" numeric>
                        {formatNumber(level.quantity)}
                      </TD>
                      <TD>
                        <StockBadge
                          quantity={toNumber(level.quantity)}
                          reorderLevel={reorderLevel}
                        />
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </table>
          </div>
        </Card>

        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Stock movements"
              description="The last twenty movements in and out."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Type</TH>
                  <TH>Reference</TH>
                  <TH>Store</TH>
                  <TH align="right">Change</TH>
                  <TH align="right">Balance</TH>
                </TR>
              </THead>
              <TBody>
                {product.movements.length === 0 ? (
                  <EmptyRow colSpan={6} message="No stock movements recorded yet." />
                ) : (
                  product.movements.map((movement) => {
                    const change = toNumber(movement.quantity)
                    return (
                      <TR key={movement.id}>
                        <TD>{formatDateTime(movement.createdAt)}</TD>
                        <TD>{humanize(movement.type)}</TD>
                        <TD>
                          <span className="tabular text-saipei-gray-600">
                            {movement.reference ?? '—'}
                          </span>
                        </TD>
                        <TD>
                          <span className="tabular">{movement.warehouse.code}</span>
                        </TD>
                        <TD align="right" numeric>
                          <span
                            className={
                              change >= 0 ? 'text-saipei-green-700' : 'text-saipei-red-600'
                            }
                          >
                            {change >= 0 ? '+' : ''}
                            {formatNumber(change)}
                          </span>
                        </TD>
                        <TD align="right" numeric>
                          {formatNumber(movement.balanceAfter)}
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
    </>
  )
}
