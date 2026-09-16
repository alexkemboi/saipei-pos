'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Select, Textarea } from '@/components/ui/form'
import { formatKes } from '@/lib/utils'
import { createSupplierInvoice, type FormState } from '../actions'

const EMPTY: FormState = {}

export function SupplierInvoiceForm({
  suppliers,
  orders,
}: {
  suppliers: { id: string; name: string; currency: string }[]
  orders: { id: string; reference: string; supplierId: string }[]
}) {
  const [state, formAction] = useActionState(createSupplierInvoice, EMPTY)
  const errors = state.fieldErrors ?? {}

  const [supplierId, setSupplierId] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [rate, setRate] = useState('129')
  const [amount, setAmount] = useState('')

  const relevant = orders.filter((order) => order.supplierId === supplierId)
  const kes = (Number(amount) || 0) * (Number(rate) || 0)

  return (
    <form action={formAction}>
      <Card>
        <CardHeader
          title="Capture a supplier invoice"
          description="Record the original invoice received from the supplier."
        />

        {state.error ? (
          <div className="mb-4">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}
        {state.success ? (
          <div className="mb-4">
            <Alert tone="success" title="Invoice captured">
              {state.success}
            </Alert>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Supplier"
            htmlFor="supplierId"
            required
            error={errors.supplierId}
            className="sm:col-span-2"
          >
            <Select
              id="supplierId"
              name="supplierId"
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

          <Field label="Against LPO" htmlFor="purchaseOrderId" hint="Optional.">
            <Select id="purchaseOrderId" name="purchaseOrderId" disabled={!supplierId}>
              <option value="">No purchase order</option>
              {relevant.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.reference}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Invoice number"
            htmlFor="invoiceNumber"
            required
            error={errors.invoiceNumber}
          >
            <Input
              id="invoiceNumber"
              name="invoiceNumber"
              className="tabular"
              invalid={Boolean(errors.invoiceNumber)}
              required
            />
          </Field>

          <Field label="Invoice date" htmlFor="invoiceDate">
            <Input
              id="invoiceDate"
              name="invoiceDate"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </Field>

          <Field label="Due date" htmlFor="dueDate">
            <Input id="dueDate" name="dueDate" type="date" />
          </Field>

          <Field label="Currency" htmlFor="currency" required>
            <Select
              id="currency"
              name="currency"
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
              name="exchangeRate"
              type="number"
              min={0}
              step="0.0001"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="tabular"
              disabled={currency === 'KES'}
            />
          </Field>

          <Field label="Amount" htmlFor="amount" required error={errors.amount}>
            <Input
              id="amount"
              name="amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="tabular"
              required
            />
          </Field>

          <Field label="Notes" htmlFor="notes" className="lg:col-span-2">
            <Textarea id="notes" name="notes" rows={2} />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-md border border-saipei-gray-200 bg-saipei-gray-50 px-4 py-3">
          <div>
            <p className="text-xs font-semibold tracking-wider text-saipei-gray-500 uppercase">
              Invoice value in shillings
            </p>
            <p className="tabular mt-0.5 text-2xl font-bold text-saipei-dark-800">
              {formatKes(kes)}
            </p>
          </div>
          <label className="flex items-center gap-2.5 text-sm text-saipei-gray-700">
            <input
              type="checkbox"
              name="isFinal"
              className="h-4 w-4 rounded border-saipei-gray-300 accent-[var(--saipei-green)]"
            />
            This is the final invoice received before shipping
          </label>
        </div>

        <div className="mt-5">
          <SubmitButton />
        </div>
      </Card>
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} icon={<FileText className="h-4 w-4" aria-hidden />}>
      {pending ? 'Saving…' : 'Capture invoice'}
    </Button>
  )
}
