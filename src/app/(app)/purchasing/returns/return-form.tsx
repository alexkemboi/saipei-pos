'use client'

import { useMemo, useState, useTransition } from 'react'
import { Plus, Trash2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Select, Textarea } from '@/components/ui/form'
import { formatKes, formatNumber } from '@/lib/utils'
import { createPurchaseReturn } from '../actions'

export interface ReturnableProduct {
  id: string
  sku: string
  name: string
  costPrice: number
  stockByWarehouse: Record<string, number>
}

interface LineRow {
  key: string
  productId: string
  quantity: string
  unitPrice: string
}

function emptyLine(index: number): LineRow {
  return {
    key: `pr-line-${Date.now()}-${index}`,
    productId: '',
    quantity: '',
    unitPrice: '',
  }
}

export function PurchaseReturnForm({
  suppliers,
  warehouses,
  products,
}: {
  suppliers: { id: string; name: string }[]
  warehouses: { id: string; name: string }[]
  products: ReturnableProduct[]
}) {
  const [supplierId, setSupplierId] = useState('')
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '')
  const [reason, setReason] = useState('')
  const [lines, setLines] = useState<LineRow[]>([emptyLine(0)])
  const [state, setState] = useState<{ error?: string; success?: string }>({})
  const [isPending, startTransition] = useTransition()

  const num = (value: string) => Number(value) || 0

  const inStock = useMemo(
    () =>
      products
        .map((product) => ({
          ...product,
          available: product.stockByWarehouse[warehouseId] ?? 0,
        }))
        .filter((product) => product.available > 0),
    [products, warehouseId],
  )

  const total = lines.reduce(
    (sum, line) => sum + num(line.quantity) * num(line.unitPrice),
    0,
  )

  function update(key: string, patch: Partial<LineRow>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    )
  }

  function submit() {
    setState({})
    startTransition(async () => {
      const result = await createPurchaseReturn({
        supplierId,
        warehouseId,
        reason: reason || undefined,
        lines: lines
          .filter((line) => line.productId && num(line.quantity) > 0)
          .map((line) => ({
            productId: line.productId,
            quantity: num(line.quantity),
            unitPrice: num(line.unitPrice),
          })),
      })
      setState(result)
      if (result.success) {
        setLines([emptyLine(0)])
        setReason('')
      }
    })
  }

  const ready =
    supplierId && lines.some((line) => line.productId && num(line.quantity) > 0)

  return (
    <div className="space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="success" title="Return recorded">
          {state.success}
        </Alert>
      ) : null}

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Return goods to a supplier"
            description="The goods leave the chosen warehouse as soon as this is saved."
          />
          <div className="grid grid-cols-1 gap-4 pb-4 sm:grid-cols-2">
            <Field label="Supplier" htmlFor="supplierId" required>
              <Select
                id="supplierId"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
              >
                <option value="">Choose a supplier…</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="From warehouse" htmlFor="warehouseId" required>
              <Select
                id="warehouseId"
                value={warehouseId}
                onChange={(e) => {
                  setWarehouseId(e.target.value)
                  setLines([emptyLine(0)])
                }}
              >
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-saipei-gray-200 bg-saipei-gray-50">
              <tr>
                {['Product', 'In stock', 'Quantity', 'Unit cost', 'Line total', ''].map(
                  (heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-saipei-dark-700 uppercase whitespace-nowrap"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-saipei-gray-100">
              {lines.map((line, index) => {
                const product = inStock.find((p) => p.id === line.productId)
                return (
                  <tr key={line.key}>
                    <td className="px-3 py-2">
                      <Select
                        value={line.productId}
                        onChange={(e) => {
                          const chosen = inStock.find((p) => p.id === e.target.value)
                          update(line.key, {
                            productId: e.target.value,
                            unitPrice: chosen ? String(chosen.costPrice) : line.unitPrice,
                          })
                        }}
                        aria-label={`Product for row ${index + 1}`}
                        className="w-60"
                      >
                        <option value="">Choose a product…</option>
                        {inStock.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} — {p.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="tabular px-3 py-2 text-right text-saipei-gray-600">
                      {product ? formatNumber(product.available) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        max={product?.available}
                        step="1"
                        value={line.quantity}
                        onChange={(e) => update(line.key, { quantity: e.target.value })}
                        aria-label={`Quantity for row ${index + 1}`}
                        className="tabular w-24 text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) => update(line.key, { unitPrice: e.target.value })}
                        aria-label={`Unit cost for row ${index + 1}`}
                        className="tabular w-28 text-right"
                      />
                    </td>
                    <td className="tabular px-3 py-2 text-right font-medium text-saipei-gray-900">
                      {formatKes(num(line.quantity) * num(line.unitPrice))}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          setLines((current) =>
                            current.length === 1
                              ? current
                              : current.filter((l) => l.key !== line.key),
                          )
                        }
                        disabled={lines.length === 1}
                        aria-label={`Remove row ${index + 1}`}
                        className="rounded p-1.5 text-saipei-gray-400 hover:bg-saipei-red-50 hover:text-saipei-red-600 disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-3 py-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setLines((current) => [...current, emptyLine(current.length)])}
            icon={<Plus className="h-4 w-4" aria-hidden />}
          >
            Add item
          </Button>
        </div>

        <div className="space-y-4 border-t border-saipei-gray-200 px-5 py-5">
          <Field label="Reason for the return" htmlFor="pr-reason">
            <Textarea
              id="pr-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. wrong specification, damaged on arrival"
            />
          </Field>

          <div className="flex items-center justify-between rounded-md border border-saipei-red-200 bg-saipei-red-50 px-4 py-3">
            <span className="font-semibold text-saipei-red-700">Value being returned</span>
            <span className="tabular text-2xl font-bold text-saipei-red-600">
              {formatKes(total)}
            </span>
          </div>

          <Button
            size="lg"
            variant="danger"
            onClick={submit}
            disabled={isPending || !ready}
            icon={<Undo2 className="h-4 w-4" aria-hidden />}
          >
            {isPending ? 'Saving…' : 'Record return'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
