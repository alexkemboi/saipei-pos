'use client'

import { useState, useTransition } from 'react'
import { ClipboardList, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Select, Textarea } from '@/components/ui/form'
import { formatKes, formatNumber } from '@/lib/utils'
import { createPurchaseOrder } from '../actions'

interface LineRow {
  key: string
  productId: string
  description: string
  quantity: string
  unitPrice: string
}

function emptyLine(index: number): LineRow {
  return {
    key: `po-line-${Date.now()}-${index}`,
    productId: '',
    description: '',
    quantity: '',
    unitPrice: '',
  }
}

export function PurchaseOrderForm({
  suppliers,
  products,
}: {
  suppliers: { id: string; name: string; currency: string }[]
  products: { id: string; sku: string; name: string }[]
}) {
  const [supplierId, setSupplierId] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [rate, setRate] = useState('129')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineRow[]>([emptyLine(0)])
  const [state, setState] = useState<{ error?: string; success?: string }>({})
  const [isPending, startTransition] = useTransition()

  const num = (value: string) => Number(value) || 0
  const subtotal = lines.reduce(
    (sum, line) => sum + num(line.quantity) * num(line.unitPrice),
    0,
  )

  function update(key: string, patch: Partial<LineRow>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    )
  }

  function submit(submitForApproval: boolean) {
    setState({})
    startTransition(async () => {
      const result = await createPurchaseOrder({
        supplierId,
        orderDate,
        expectedDate: expectedDate || undefined,
        currency,
        exchangeRate: num(rate),
        notes: notes || undefined,
        submitForApproval,
        lines: lines
          .filter((line) => line.description.trim() && num(line.quantity) > 0)
          .map((line) => ({
            productId: line.productId || undefined,
            description: line.description.trim(),
            quantity: num(line.quantity),
            unitPrice: num(line.unitPrice),
          })),
      })
      setState(result)
      if (result.success) {
        setLines([emptyLine(0)])
        setNotes('')
      }
    })
  }

  const ready =
    supplierId &&
    num(rate) > 0 &&
    lines.some((line) => line.description.trim() && num(line.quantity) > 0)

  return (
    <div className="space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="success" title="Order raised">
          {state.success}
        </Alert>
      ) : null}

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Raise a local purchase order"
            description="An LPO reference is allocated automatically as LPO-YYYY-NNNN."
          />
          <div className="grid grid-cols-1 gap-4 pb-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Supplier" htmlFor="supplierId" required className="sm:col-span-2">
              <Select
                id="supplierId"
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value)
                  const supplier = suppliers.find((s) => s.id === e.target.value)
                  if (supplier) {
                    setCurrency(supplier.currency)
                    if (supplier.currency === 'KES') setRate('1')
                  }
                }}
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

            <Field label="Order date" htmlFor="orderDate" required>
              <Input
                id="orderDate"
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </Field>

            <Field label="Expected delivery" htmlFor="expectedDate">
              <Input
                id="expectedDate"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </Field>

            <Field label="Currency" htmlFor="currency" required>
              <Select
                id="currency"
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value)
                  if (e.target.value === 'KES') setRate('1')
                }}
              >
                <option value="USD">USD</option>
                <option value="CNY">CNY</option>
                <option value="EUR">EUR</option>
                <option value="KES">KES</option>
              </Select>
            </Field>

            <Field label="Rate to KES" htmlFor="exchangeRate" required>
              <Input
                id="exchangeRate"
                type="number"
                min={0}
                step="0.0001"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="tabular"
                disabled={currency === 'KES'}
              />
            </Field>
          </div>
        </div>

        {/* --- Lines --- */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-saipei-gray-200 bg-saipei-gray-50">
              <tr>
                {['Stock item', 'Description', 'Quantity', 'Unit price', 'Line total', ''].map(
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
              {lines.map((line, index) => (
                <tr key={line.key}>
                  <td className="px-3 py-2">
                    <Select
                      value={line.productId}
                      onChange={(e) => {
                        const product = products.find((p) => p.id === e.target.value)
                        update(line.key, {
                          productId: e.target.value,
                          description:
                            product && !line.description ? product.name : line.description,
                        })
                      }}
                      aria-label={`Stock item for row ${index + 1}`}
                      className="w-52"
                    >
                      <option value="">Free text</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} — {product.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={line.description}
                      onChange={(e) => update(line.key, { description: e.target.value })}
                      placeholder="What is being ordered"
                      aria-label={`Description for row ${index + 1}`}
                      className="w-56"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
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
                      aria-label={`Unit price for row ${index + 1}`}
                      className="tabular w-28 text-right"
                    />
                  </td>
                  <td className="tabular px-3 py-2 text-right font-medium text-saipei-gray-900 whitespace-nowrap">
                    {currency} {formatNumber(num(line.quantity) * num(line.unitPrice), 2)}
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
              ))}
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
            Add line
          </Button>
        </div>

        <div className="space-y-4 border-t border-saipei-gray-200 px-5 py-5">
          <Field label="Notes" htmlFor="po-notes">
            <Textarea
              id="po-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Terms, delivery instructions, specifications…"
            />
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-saipei-gray-200 bg-saipei-gray-50 px-4 py-3">
            <div>
              <p className="text-xs font-semibold tracking-wider text-saipei-gray-500 uppercase">
                Order total
              </p>
              <p className="tabular mt-0.5 text-2xl font-bold text-saipei-dark-800">
                {currency} {formatNumber(subtotal, 2)}
              </p>
              <p className="tabular text-xs text-saipei-gray-500">
                {formatKes(subtotal * num(rate))}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="neutral"
              size="lg"
              onClick={() => submit(false)}
              disabled={isPending || !ready}
            >
              Save as draft
            </Button>
            <Button
              size="lg"
              onClick={() => submit(true)}
              disabled={isPending || !ready}
              icon={<ClipboardList className="h-4 w-4" aria-hidden />}
            >
              {isPending ? 'Saving…' : 'Submit for approval'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
