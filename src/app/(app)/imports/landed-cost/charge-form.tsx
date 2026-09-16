'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Select } from '@/components/ui/form'
import { formatKes, humanize } from '@/lib/utils'
import { addLandedCostCharge, type FormState } from '../actions'

const EMPTY: FormState = {}

const CATEGORIES = [
  'FREIGHT',
  'CLEARING_AGENT_FEE',
  'PORT_CFS',
  'SHIPPING',
  'TRANSPORT',
  'OFFLOADING',
  'WAREHOUSE',
  'INSPECTION',
  'ACA_PAYMENT',
  'FUMIGATION',
  'CUSTOMS_TAXES',
  'OTHER',
]

export function ChargeForm({
  orders,
  shipments,
}: {
  orders: { id: string; label: string }[]
  shipments: { id: string; importOrderId: string; label: string }[]
}) {
  const [state, formAction] = useActionState(addLandedCostCharge, EMPTY)
  const errors = state.fieldErrors ?? {}
  const [importOrderId, setImportOrderId] = useState('')
  const [currency, setCurrency] = useState('KES')
  const [rate, setRate] = useState('1')
  const [amount, setAmount] = useState('')

  const relevant = shipments.filter((s) => s.importOrderId === importOrderId)
  const kes = (Number(amount) || 0) * (Number(rate) || 0)

  return (
    <form action={formAction}>
      <Card>
        <CardHeader
          title="Add a charge"
          description="Anything paid to get this consignment onto the shelf."
        />

        {state.error ? (
          <div className="mb-4">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}
        {state.success ? (
          <div className="mb-4">
            <Alert tone="success" title="Charge captured">
              {state.success}
            </Alert>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Import order"
            htmlFor="importOrderId"
            required
            error={errors.importOrderId}
            className="sm:col-span-2"
          >
            <Select
              id="importOrderId"
              name="importOrderId"
              value={importOrderId}
              onChange={(e) => setImportOrderId(e.target.value)}
              required
            >
              <option value="">Choose an import order…</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Shipment" htmlFor="shipmentId" hint="Optional.">
            <Select id="shipmentId" name="shipmentId" disabled={!importOrderId}>
              <option value="">Whole order</option>
              {relevant.map((shipment) => (
                <option key={shipment.id} value={shipment.id}>
                  {shipment.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Category" htmlFor="category" required>
            <Select id="category" name="category" defaultValue="FREIGHT" required>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {humanize(category)}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            required
            error={errors.description}
            className="sm:col-span-2"
          >
            <Input
              id="description"
              name="description"
              placeholder="e.g. Ocean freight Shanghai–Mombasa"
              required
            />
          </Field>

          <Field label="Payee" htmlFor="payeeName">
            <Input id="payeeName" name="payeeName" placeholder="Who was paid" />
          </Field>

          <Field label="Reference" htmlFor="reference">
            <Input id="reference" name="reference" className="tabular" placeholder="Invoice or receipt no." />
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
              <option value="KES">KES</option>
              <option value="USD">USD</option>
              <option value="CNY">CNY</option>
              <option value="EUR">EUR</option>
            </Select>
          </Field>

          <Field label="Amount" htmlFor="amount" required>
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

          <Field label="Charge date" htmlFor="chargeDate">
            <Input
              id="chargeDate"
              name="chargeDate"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-md border border-saipei-gray-200 bg-saipei-gray-50 px-4 py-3">
          <div>
            <p className="text-xs font-semibold tracking-wider text-saipei-gray-500 uppercase">
              Amount in shillings
            </p>
            <p className="tabular mt-0.5 text-2xl font-bold text-saipei-dark-800">
              {formatKes(kes)}
            </p>
          </div>
          <label className="flex items-center gap-2.5 text-sm text-saipei-gray-700">
            <input
              type="checkbox"
              name="isPaid"
              className="h-4 w-4 rounded border-saipei-gray-300 accent-[var(--saipei-green)]"
            />
            This charge has already been paid
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
    <Button type="submit" disabled={pending} icon={<Plus className="h-4 w-4" aria-hidden />}>
      {pending ? 'Saving…' : 'Add charge'}
    </Button>
  )
}
