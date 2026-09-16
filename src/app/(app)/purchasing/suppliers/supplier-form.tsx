'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Select, Textarea } from '@/components/ui/form'
import type { FormState } from '../actions'

export interface SupplierValues {
  name: string
  type: string
  country: string
  contactName: string
  phone: string
  email: string
  address: string
  taxPin: string
  currency: string
  isActive: boolean
}

const EMPTY: FormState = {}

export function SupplierForm({
  action,
  values,
  submitLabel = 'Save supplier',
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>
  values?: Partial<SupplierValues>
  submitLabel?: string
}) {
  const [state, formAction] = useActionState(action, EMPTY)
  const errors = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="max-w-3xl space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Card>
        <CardHeader title="Supplier details" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Supplier name"
            htmlFor="name"
            required
            error={errors.name}
            className="sm:col-span-2"
          >
            <Input
              id="name"
              name="name"
              defaultValue={values?.name}
              invalid={Boolean(errors.name)}
              placeholder="e.g. Guangzhou Footwear Trading Co. Ltd"
              autoFocus
            />
          </Field>

          <Field label="Type" htmlFor="type" required>
            <Select id="type" name="type" defaultValue={values?.type ?? 'FOREIGN'}>
              <option value="FOREIGN">Foreign — imported goods</option>
              <option value="LOCAL">Local — bought in Kenya</option>
            </Select>
          </Field>

          <Field label="Country" htmlFor="country">
            <Input id="country" name="country" defaultValue={values?.country} placeholder="e.g. China" />
          </Field>

          <Field label="Contact person" htmlFor="contactName">
            <Input id="contactName" name="contactName" defaultValue={values?.contactName} />
          </Field>

          <Field label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={values?.phone} inputMode="tel" />
          </Field>

          <Field label="Email" htmlFor="email" error={errors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={values?.email}
              invalid={Boolean(errors.email)}
            />
          </Field>

          <Field label="Trading currency" htmlFor="currency" required>
            <Select id="currency" name="currency" defaultValue={values?.currency ?? 'USD'}>
              <option value="USD">USD — US Dollar</option>
              <option value="CNY">CNY — Chinese Yuan</option>
              <option value="EUR">EUR — Euro</option>
              <option value="KES">KES — Kenyan Shilling</option>
            </Select>
          </Field>

          <Field label="KRA PIN" htmlFor="taxPin" hint="For local suppliers.">
            <Input id="taxPin" name="taxPin" defaultValue={values?.taxPin} className="tabular" />
          </Field>

          <Field label="Address" htmlFor="address" className="sm:col-span-2">
            <Textarea id="address" name="address" rows={2} defaultValue={values?.address} />
          </Field>

          <label className="flex items-center gap-2.5 text-sm text-saipei-gray-700 sm:col-span-2">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={values?.isActive ?? true}
              className="h-4 w-4 rounded border-saipei-gray-300 accent-[var(--saipei-green)]"
            />
            Active — orders can be placed with this supplier
          </label>
        </div>
      </Card>

      <div className="flex gap-3">
        <Link href="/purchasing/suppliers">
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
