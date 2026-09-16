'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Select, Textarea } from '@/components/ui/form'
import { formatKes } from '@/lib/utils'
import { createImportOrder, type FormState } from '../actions'

const EMPTY: FormState = {}

export function ImportOrderForm({
  suppliers,
}: {
  suppliers: { id: string; name: string; country: string | null; currency: string }[]
}) {
  const [state, formAction] = useActionState(createImportOrder, EMPTY)
  const errors = state.fieldErrors ?? {}

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '')
  const [currency, setCurrency] = useState(suppliers[0]?.currency ?? 'USD')
  const [rate, setRate] = useState('129')
  const [value, setValue] = useState('')

  const kes = (Number(value) || 0) * (Number(rate) || 0)

  return (
    <form action={formAction} className="max-w-3xl space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Card>
        <CardHeader
          title="Order details"
          description="A unique reference is allocated automatically as IMP-YYYY-NNNN."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Supplier" htmlFor="supplierId" required error={errors.supplierId} className="sm:col-span-2">
            <Select
              id="supplierId"
              name="supplierId"
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value)
                const supplier = suppliers.find((s) => s.id === e.target.value)
                if (supplier) setCurrency(supplier.currency)
              }}
              required
            >
              <option value="">Choose a supplier…</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                  {supplier.country ? ` — ${supplier.country}` : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Order date" htmlFor="orderDate" required>
            <Input
              id="orderDate"
              name="orderDate"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </Field>

          <Field label="Currency" htmlFor="currency" required>
            <Select
              id="currency"
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="USD">USD — US Dollar</option>
              <option value="CNY">CNY — Chinese Yuan</option>
              <option value="EUR">EUR — Euro</option>
              <option value="KES">KES — Kenyan Shilling</option>
            </Select>
          </Field>

          <Field
            label="Goods value"
            htmlFor="goodsValue"
            required
            hint="The value on the supplier's proforma or invoice."
          >
            <Input
              id="goodsValue"
              name="goodsValue"
              type="number"
              min={0}
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="tabular"
            />
          </Field>

          <Field
            label="Exchange rate to KES"
            htmlFor="exchangeRate"
            required
            error={errors.exchangeRate}
          >
            <Input
              id="exchangeRate"
              name="exchangeRate"
              type="number"
              min={0}
              step="0.0001"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="tabular"
              invalid={Boolean(errors.exchangeRate)}
            />
          </Field>

          <div className="rounded-md border border-saipei-gray-200 bg-saipei-gray-50 px-4 py-3 sm:col-span-2">
            <p className="text-xs font-semibold tracking-wider text-saipei-gray-500 uppercase">
              Goods value in shillings
            </p>
            <p className="tabular mt-0.5 text-2xl font-bold text-saipei-dark-800">
              {formatKes(kes)}
            </p>
            <p className="mt-0.5 text-xs text-saipei-gray-500">
              Freight, duty and clearing charges are added later and form the landed cost.
            </p>
          </div>

          <Field label="Description" htmlFor="description" className="sm:col-span-2">
            <Textarea
              id="description"
              name="description"
              rows={2}
              placeholder="e.g. 2 x 40ft containers of assorted shoes"
            />
          </Field>
        </div>
      </Card>

      <div className="flex gap-3">
        <Link href="/imports">
          <Button variant="neutral" type="button">
            Cancel
          </Button>
        </Link>
        <SubmitButton />
      </div>
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} icon={<Save className="h-4 w-4" aria-hidden />}>
      {pending ? 'Saving…' : 'Create import order'}
    </Button>
  )
}
