import type { Metadata } from 'next'
import Link from 'next/link'
import { Package, Plus } from 'lucide-react'
import { StockBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ListFilters, Pagination } from '@/components/ui/filters'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatKes, formatNumber, humanize, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Products' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const user = await requirePermission('inventory.view')
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const where: Record<string, unknown> = {}
  if (params.categoryId) where.categoryId = params.categoryId
  if (params.active === 'yes') where.isActive = true
  if (params.active === 'no') where.isActive = false
  if (params.q) {
    where.OR = [
      { name: { contains: params.q } },
      { sku: { contains: params.q } },
      { barcode: { contains: params.q } },
    ]
  }

  const [rows, total, categories] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        sku: true,
        barcode: true,
        name: true,
        unit: true,
        costPrice: true,
        sellingPrice: true,
        reorderLevel: true,
        isActive: true,
        category: { select: { name: true } },
        stockLevels: { select: { quantity: true } },
      },
    }),
    db.product.count({ where }),
    db.category.findMany({ orderBy: { name: 'asc' } }),
  ])

  const items = rows.map((product) => {
    const quantity = product.stockLevels.reduce(
      (sum, level) => sum + toNumber(level.quantity),
      0,
    )
    const cost = toNumber(product.costPrice)
    const price = toNumber(product.sellingPrice)
    return {
      ...product,
      quantity,
      cost,
      price,
      reorderLevel: toNumber(product.reorderLevel),
      margin: price > 0 ? ((price - cost) / price) * 100 : 0,
    }
  })

  const stockValue = items.reduce((sum, item) => sum + item.quantity * item.cost, 0)

  return (
    <>
      <PageHeader
        breadcrumb="Warehousing & Inventory"
        title="Products"
        description="The catalogue sold at the till, with cost, price and stock."
        action={
          user.permissions.includes('products.manage') ? (
            <Link href="/inventory/products/new">
              <Button icon={<Plus className="h-4 w-4" aria-hidden />}>New product</Button>
            </Link>
          ) : null
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Products"
          value={formatNumber(total)}
          sublabel="matching the current filters"
          tone="dark"
          icon={<Package className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Stock value on this page"
          value={formatKes(stockValue)}
          sublabel="at weighted average cost"
          tone="green"
        />
        <StatCard
          label="Needing reorder"
          value={formatNumber(items.filter((i) => i.quantity <= i.reorderLevel).length)}
          sublabel="on this page"
          tone="amber"
        />
      </div>

      <ListFilters
        searchPlaceholder="Search by name, SKU or barcode…"
        selects={[
          {
            name: 'categoryId',
            label: 'Category',
            options: categories.map((c) => ({ value: c.id, label: c.name })),
          },
          {
            name: 'active',
            label: 'Status',
            options: [
              { value: 'yes', label: 'Active' },
              { value: 'no', label: 'Inactive' },
            ],
          },
        ]}
      />

      <Table>
        <THead>
          <TR>
            <TH>SKU</TH>
            <TH>Product</TH>
            <TH>Category</TH>
            <TH>Unit</TH>
            <TH align="right">Cost</TH>
            <TH align="right">Price</TH>
            <TH align="right">Margin</TH>
            <TH align="right">On hand</TH>
            <TH>Stock</TH>
          </TR>
        </THead>
        <TBody>
          {items.length === 0 ? (
            <EmptyRow colSpan={9} message="No products match these filters." />
          ) : (
            items.map((product) => (
              <TR key={product.id}>
                <TD>
                  <span className="tabular text-saipei-gray-600">{product.sku}</span>
                </TD>
                <TD>
                  <Link
                    href={`/inventory/products/${product.id}`}
                    className="font-semibold text-saipei-dark-700 hover:text-saipei-green-700 hover:underline"
                  >
                    {product.name}
                  </Link>
                  {!product.isActive ? (
                    <span className="ml-2 text-xs text-saipei-gray-400">(inactive)</span>
                  ) : null}
                </TD>
                <TD>{product.category?.name ?? '—'}</TD>
                <TD>{humanize(product.unit)}</TD>
                <TD align="right" numeric>
                  {formatKes(product.cost)}
                </TD>
                <TD align="right" numeric>
                  {formatKes(product.price)}
                </TD>
                <TD align="right" numeric>
                  {product.margin.toFixed(1)}%
                </TD>
                <TD align="right" numeric>
                  {formatNumber(product.quantity)}
                </TD>
                <TD>
                  <StockBadge
                    quantity={product.quantity}
                    reorderLevel={product.reorderLevel}
                  />
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
