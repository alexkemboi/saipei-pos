'use client'

import { useMemo, useState, useTransition } from 'react'
import { ClipboardCheck, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Select, Textarea } from '@/components/ui/form'
import { formatNumber } from '@/lib/utils'
import { postStockTake } from '../movements-actions'

export interface CountableProduct {
  id: string
  sku: string
  name: string
  stockByWarehouse: Record<string, number>
}

export function StockTakeForm({
  warehouses,
  products,
}: {
  warehouses: { id: string; name: string }[]
  products: CountableProduct[]
}) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '')
  const [search, setSearch] = useState('')
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [state, setState] = useState<{ error?: string; success?: string }>({})
  const [isPending, startTransition] = useTransition()

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products
      .map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        systemQty: product.stockByWarehouse[warehouseId] ?? 0,
      }))
      .filter(
        (row) =>
          !term ||
          row.name.toLowerCase().includes(term) ||
          row.sku.toLowerCase().includes(term),
      )
  }, [products, warehouseId, search])

  const counted = rows.filter((row) => counts[row.id] !== undefined && counts[row.id] !== '')
  const variances = counted.filter(
    (row) => Number(counts[row.id]) !== row.systemQty,
  )
  const netVariance = variances.reduce(
    (sum, row) => sum + (Number(counts[row.id]) - row.systemQty),
    0,
  )

  function submit() {
    setState({})
    startTransition(async () => {
      const result = await postStockTake({
        warehouseId,
        notes: notes || undefined,
        lines: counted.map((row) => ({
          productId: row.id,
          systemQty: row.systemQty,
          countedQty: Number(counts[row.id]),
        })),
      })
      setState(result)
      if (result.success) {
        setCounts({})
        setNotes('')
      }
    })
  }

  return (
    <div className="space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="success" title="Stock take posted">
          {state.success}
        </Alert>
      ) : null}

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Physical count"
            description="Enter what you actually counted. Blank rows are left untouched."
          />
          <div className="grid grid-cols-1 gap-4 pb-4 sm:grid-cols-2">
            <Field label="Warehouse" htmlFor="warehouseId" required>
              <Select
                id="warehouseId"
                value={warehouseId}
                onChange={(e) => {
                  setWarehouseId(e.target.value)
                  setCounts({})
                }}
              >
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Find a product" htmlFor="stock-take-search">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-saipei-gray-400"
                  aria-hidden
                />
                <Input
                  id="stock-take-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or SKU…"
                  className="pl-9"
                />
              </div>
            </Field>
          </div>
        </div>

        <div className="max-h-[28rem] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 border-y border-saipei-gray-200 bg-saipei-gray-50">
              <tr>
                {['SKU', 'Product', 'System', 'Counted', 'Variance'].map((heading, index) => (
                  <th
                    key={heading}
                    scope="col"
                    className={
                      'px-4 py-2.5 text-xs font-semibold tracking-wide text-saipei-dark-700 uppercase ' +
                      (index >= 2 ? 'text-right' : 'text-left')
                    }
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-saipei-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-saipei-gray-500">
                    No products match that search.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const raw = counts[row.id]
                  const hasCount = raw !== undefined && raw !== ''
                  const variance = hasCount ? Number(raw) - row.systemQty : 0

                  return (
                    <tr key={row.id} className={hasCount ? 'bg-saipei-green-50/40' : undefined}>
                      <td className="tabular px-4 py-2 text-saipei-gray-600">{row.sku}</td>
                      <td className="px-4 py-2 font-medium text-saipei-dark-800">
                        {row.name}
                      </td>
                      <td className="tabular px-4 py-2 text-right text-saipei-gray-700">
                        {formatNumber(row.systemQty)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          value={raw ?? ''}
                          onChange={(e) =>
                            setCounts((current) => ({
                              ...current,
                              [row.id]: e.target.value,
                            }))
                          }
                          aria-label={`Counted quantity for ${row.name}`}
                          className="tabular ml-auto w-24 text-right"
                          placeholder="—"
                        />
                      </td>
                      <td className="tabular px-4 py-2 text-right font-medium">
                        {hasCount ? (
                          <span
                            className={
                              variance === 0
                                ? 'text-saipei-gray-400'
                                : variance > 0
                                  ? 'text-saipei-green-700'
                                  : 'text-saipei-red-600'
                            }
                          >
                            {variance > 0 ? '+' : ''}
                            {formatNumber(variance)}
                          </span>
                        ) : (
                          <span className="text-saipei-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 border-t border-saipei-gray-200 px-5 py-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Summary label="Items counted" value={formatNumber(counted.length)} />
            <Summary label="Variances found" value={formatNumber(variances.length)} />
            <Summary
              label="Net variance"
              value={`${netVariance > 0 ? '+' : ''}${formatNumber(netVariance)}`}
              tone={netVariance === 0 ? 'neutral' : netVariance > 0 ? 'green' : 'red'}
            />
          </div>

          <Field label="Notes" htmlFor="stock-take-notes">
            <Textarea
              id="stock-take-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Who counted, and anything unusual"
            />
          </Field>

          <Button
            size="lg"
            onClick={submit}
            disabled={isPending || counted.length === 0}
            icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}
          >
            {isPending ? 'Posting…' : 'Post stock take'}
          </Button>
          <p className="text-xs text-saipei-gray-500">
            Posting sets the counted quantity as the new stock figure and records the
            variance against each item.
          </p>
        </div>
      </Card>
    </div>
  )
}

function Summary({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'green' | 'red'
}) {
  const colour =
    tone === 'green'
      ? 'text-saipei-green-700'
      : tone === 'red'
        ? 'text-saipei-red-600'
        : 'text-saipei-dark-800'

  return (
    <div className="rounded-md border border-saipei-gray-200 bg-saipei-gray-50 px-4 py-3">
      <p className="text-xs font-semibold tracking-wider text-saipei-gray-500 uppercase">
        {label}
      </p>
      <p className={`tabular mt-0.5 text-xl font-bold ${colour}`}>{value}</p>
    </div>
  )
}
