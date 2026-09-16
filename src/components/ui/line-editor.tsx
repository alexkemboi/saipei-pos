'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/form'
import { formatNumber } from '@/lib/utils'

export interface LineProduct {
  id: string
  sku: string
  name: string
  quantity?: number
}

export interface EditableLine {
  key: string
  productId: string
  quantity: string
}

export function newLine(index = 0): EditableLine {
  return { key: `line-${Date.now()}-${index}`, productId: '', quantity: '' }
}

/**
 * The product/quantity grid shared by transfers and adjustments. Quantities may
 * be negative for adjustments, which `allowNegative` controls.
 */
export function LineEditor({
  lines,
  products,
  onChange,
  allowNegative = false,
  quantityLabel = 'Quantity',
  availabilityLabel,
}: {
  lines: EditableLine[]
  products: LineProduct[]
  onChange: (lines: EditableLine[]) => void
  allowNegative?: boolean
  quantityLabel?: string
  availabilityLabel?: string
}) {
  const chosen = new Set(lines.map((line) => line.productId).filter(Boolean))

  function update(key: string, patch: Partial<EditableLine>) {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="border-y border-saipei-gray-200 bg-saipei-gray-50">
            <tr>
              <th
                scope="col"
                className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-saipei-dark-700 uppercase"
              >
                Product
              </th>
              {availabilityLabel ? (
                <th
                  scope="col"
                  className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-saipei-dark-700 uppercase whitespace-nowrap"
                >
                  {availabilityLabel}
                </th>
              ) : null}
              <th
                scope="col"
                className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-saipei-dark-700 uppercase whitespace-nowrap"
              >
                {quantityLabel}
              </th>
              <th scope="col" className="w-10 px-3 py-2.5">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-saipei-gray-100">
            {lines.map((line, index) => {
              const product = products.find((p) => p.id === line.productId)
              return (
                <tr key={line.key}>
                  <td className="px-3 py-2">
                    <Select
                      value={line.productId}
                      onChange={(e) => update(line.key, { productId: e.target.value })}
                      aria-label={`Product for row ${index + 1}`}
                    >
                      <option value="">Choose a product…</option>
                      {products
                        .filter((p) => p.id === line.productId || !chosen.has(p.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} — {p.name}
                          </option>
                        ))}
                    </Select>
                  </td>
                  {availabilityLabel ? (
                    <td className="tabular px-3 py-2 text-right text-saipei-gray-600">
                      {product?.quantity !== undefined
                        ? formatNumber(product.quantity)
                        : '—'}
                    </td>
                  ) : null}
                  <td className="px-3 py-2 text-right">
                    <Input
                      type="number"
                      step="1"
                      min={allowNegative ? undefined : 0}
                      value={line.quantity}
                      onChange={(e) => update(line.key, { quantity: e.target.value })}
                      aria-label={`${quantityLabel} for row ${index + 1}`}
                      className="tabular ml-auto w-28 text-right"
                      placeholder={allowNegative ? '-5' : '0'}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        onChange(
                          lines.length === 1
                            ? lines
                            : lines.filter((l) => l.key !== line.key),
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
          onClick={() => onChange([...lines, newLine(lines.length)])}
          icon={<Plus className="h-4 w-4" aria-hidden />}
        >
          Add item
        </Button>
      </div>
    </div>
  )
}
