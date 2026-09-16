'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Landmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Select } from '@/components/ui/form'
import { formatKes } from '@/lib/utils'
import { createCustomsEntry, type FormState } from '../actions'

const EMPTY: FormState = {}

const TAX_FIELDS = [
  { name: 'importDuty', label: 'Import duty' },
  { name: 'vat', label: 'VAT' },
  { name: 'idfFee', label: 'IDF fee' },
  { name: 'railwayLevy', label: 'Railway development levy' },
  { name: 'importDeclLevy', label: 'Import declaration levy' },
  { name: 'exciseDuty', label: 'Excise duty' },
  { name: 'otherLevies', label: 'Other levies' },
]

export function CustomsEntryForm({
  shipments,
}: {
  shipments: { id: string; label: string }[]
}) {
  const [state, formAction] = useActionState(createCustomsEntry, EMPTY)
  const errors = state.fieldErrors ?? {}
  const [amounts, setAmounts] = useState<Record<string, string>>({})

  const total = TAX_FIELDS.reduce(
    (sum, field) => sum + (Number(amounts[field.name]) || 0),
    0,
  )

  return (
    <form action={formAction}>
      <Card>
        <CardHeader
          title="Capture a customs declaration"
          description="The total is added to the consignment's landed cost automatically."
        />

        {state.error ? (
          <div className="mb-4">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}
        {state.success ? (
          <div className="mb-4">
            <Alert tone="success" title="Entry captured">
              {state.success}
            </Alert>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Shipment"
            htmlFor="shipmentId"
            required
            error={errors.shipmentId}
            className="sm:col-span-2"
          >
            <Select id="shipmentId" name="shipmentId" required>
              <option value="">Choose a shipment…</option>
              {shipments.map((shipment) => (
                <option key={shipment.id} value={shipment.id}>
                  {shipment.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Entry number"
            htmlFor="entryNumber"
            required
            error={errors.entryNumber}
          >
            <Input
              id="entryNumber"
              name="entryNumber"
              className="tabular"
              placeholder="e.g. 2026MSA1234567"
              required
            />
          </Field>

          <Field label="Entry date" htmlFor="entryDate">
            <Input
              id="entryDate"
              name="entryDate"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </Field>

          <Field label="Customs value (KES)" htmlFor="customsValue">
            <Input
              id="customsValue"
              name="customsValue"
              type="number"
              min={0}
              step="0.01"
              defaultValue={0}
              className="tabular"
            />
          </Field>

          {TAX_FIELDS.map((field) => (
            <Field key={field.name} label={`${field.label} (KES)`} htmlFor={field.name}>
              <Input
                id={field.name}
                name={field.name}
                type="number"
                min={0}
                step="0.01"
                value={amounts[field.name] ?? ''}
                placeholder="0"
                onChange={(e) =>
                  setAmounts((current) => ({ ...current, [field.name]: e.target.value }))
                }
                className="tabular"
              />
            </Field>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-md border border-saipei-dark-200 bg-saipei-dark-50 px-4 py-3">
          <div>
            <p className="text-xs font-semibold tracking-wider text-saipei-dark-700 uppercase">
              Total taxes payable to KRA
            </p>
            <p className="tabular mt-0.5 text-2xl font-bold text-saipei-dark-800">
              {formatKes(total)}
            </p>
          </div>
          <label className="flex items-center gap-2.5 text-sm text-saipei-gray-700">
            <input
              type="checkbox"
              name="markPaid"
              className="h-4 w-4 rounded border-saipei-gray-300 accent-[var(--saipei-green)]"
            />
            These taxes have already been paid
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
    <Button type="submit" disabled={pending} icon={<Landmark className="h-4 w-4" aria-hidden />}>
      {pending ? 'Saving…' : 'Capture entry'}
    </Button>
  )
}
