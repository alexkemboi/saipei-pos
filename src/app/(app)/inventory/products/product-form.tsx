'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Select, Textarea } from '@/components/ui/form'
import { formatKes } from '@/lib/utils'
import type { FormState } from './actions'

export interface ProductValues {
  sku: string
  barcode: string
  name: string
  description: string
  categoryId: string
  unit: string
  costPrice: number
  sellingPrice: number
  reorderLevel: number
  taxRate: number
  isActive: boolean
}

const UNITS = [
  { value: 'PAIR', label: 'Pair' },
  { value: 'PIECE', label: 'Piece' },
  { value: 'BALE', label: 'Bale' },
  { value: 'CARTON', label: 'Carton' },
  { value: 'DOZEN', label: 'Dozen' },
  { value: 'KG', label: 'Kilogram' },
]

const EMPTY: FormState = {}

export function ProductForm({
  action,
  categories,
  values,
  submitLabel = 'Save product',
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>
  categories: { id: string; name: string }[]
  values?: Partial<ProductValues>
  submitLabel?: string
}) {
  const [state, formAction] = useActionState(action, EMPTY)
  const errors = state.fieldErrors ?? {}

  const [cost, setCost] = useState(values?.costPrice ?? 0)
  const [price, setPrice] = useState(values?.sellingPrice ?? 0)
  const margin = price > 0 ? ((price - cost) / price) * 100 : 0

  return (
    <form action={formAction} className="max-w-3xl space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Card>
        <CardHeader title="Product details" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Product name" htmlFor="name" required error={errors.name} className="sm:col-span-2">
            <Input
              id="name"
              name="name"
              defaultValue={values?.name}
              invalid={Boolean(errors.name)}
              placeholder="e.g. Men's Leather Shoes - Black"
              autoFocus
            />
          </Field>

          <Field
            label="SKU"
            htmlFor="sku"
            hint="Leave blank to allocate one automatically."
            error={errors.sku}
          >
            <Input
              id="sku"
              name="sku"
              defaultValue={values?.sku}
              invalid={Boolean(errors.sku)}
              className="tabular"
              placeholder="SH-M-001"
            />
          </Field>

          <Field label="Barcode" htmlFor="barcode" error={errors.barcode}>
            <Input
              id="barcode"
              name="barcode"
              defaultValue={values?.barcode}
              invalid={Boolean(errors.barcode)}
              className="tabular"
              placeholder="Scan or type"
            />
          </Field>

          <Field label="Category" htmlFor="categoryId">
            <Select id="categoryId" name="categoryId" defaultValue={values?.categoryId ?? ''}>
              <option value="">Uncategorised</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Unit of measure" htmlFor="unit" required>
            <Select id="unit" name="unit" defaultValue={values?.unit ?? 'PAIR'}>
              {UNITS.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unit.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Description" htmlFor="description" className="sm:col-span-2">
            <Textarea id="description" name="description" rows={2} defaultValue={values?.description} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Pricing and stock control"
          description="Selling prices are VAT-inclusive."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cost price (KES)" htmlFor="costPrice" hint="Weighted average landed cost.">
            <Input
              id="costPrice"
              name="costPrice"
              type="number"
              min={0}
              step="0.01"
              value={cost}
              onChange={(e) => setCost(Number(e.target.value) || 0)}
              className="tabular"
            />
          </Field>

          <Field label="Selling price (KES)" htmlFor="sellingPrice" required>
            <Input
              id="sellingPrice"
              name="sellingPrice"
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value) || 0)}
              className="tabular"
            />
          </Field>

          <div className="rounded-md border border-saipei-gray-200 bg-saipei-gray-50 px-4 py-3 sm:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-saipei-gray-600">
                Gross margin
              </span>
              <span
                className={
                  'tabular text-lg font-bold ' +
                  (margin >= 0 ? 'text-saipei-green-700' : 'text-saipei-red-600')
                }
              >
                {margin.toFixed(1)}%
              </span>
            </div>
            <p className="tabular mt-0.5 text-xs text-saipei-gray-500">
              {formatKes(price - cost)} profit per unit
            </p>
          </div>

          <Field
            label="Reorder level"
            htmlFor="reorderLevel"
            hint="Stock at or below this level is flagged as low."
          >
            <Input
              id="reorderLevel"
              name="reorderLevel"
              type="number"
              min={0}
              step="1"
              defaultValue={values?.reorderLevel ?? 0}
              className="tabular"
            />
          </Field>

          <Field label="VAT rate (%)" htmlFor="taxRate">
            <Input
              id="taxRate"
              name="taxRate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={values?.taxRate ?? 16}
              className="tabular"
            />
          </Field>

          <label className="flex items-center gap-2.5 text-sm text-saipei-gray-700 sm:col-span-2">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={values?.isActive ?? true}
              className="h-4 w-4 rounded border-saipei-gray-300 accent-[var(--saipei-green)]"
            />
            Active — this product can be sold at the till
          </label>
        </div>
      </Card>

      <div className="flex gap-3">
        <Link href="/inventory/products">
          <Button variant="neutral" type="button">
            Cancel
          </Button>
        </Link>
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  )
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} icon={<Save className="h-4 w-4" aria-hidden />}>
      {pending ? 'Saving…' : label}
    </Button>
  )
}
