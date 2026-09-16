'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Textarea } from '@/components/ui/form'
import type { FormState } from './actions'

export interface CustomerValues {
  name: string
  phone: string
  email: string
  address: string
  taxPin: string
  creditLimit: number
  isActive: boolean
}

const EMPTY: FormState = {}

export function CustomerForm({
  action,
  values,
  submitLabel = 'Save customer',
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>
  values?: Partial<CustomerValues>
  submitLabel?: string
}) {
  const [state, formAction] = useActionState(action, EMPTY)
  const errors = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="max-w-3xl space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Card>
        <CardHeader title="Customer details" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Customer name"
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
              placeholder="e.g. Mama Njeri Shoe Shop"
              autoFocus
            />
          </Field>

          <Field label="Phone" htmlFor="phone" error={errors.phone}>
            <Input
              id="phone"
              name="phone"
              defaultValue={values?.phone}
              placeholder="+254 7XX XXX XXX"
              inputMode="tel"
            />
          </Field>

          <Field label="Email" htmlFor="email" error={errors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={values?.email}
              invalid={Boolean(errors.email)}
              placeholder="name@example.com"
            />
          </Field>

          <Field label="KRA PIN" htmlFor="taxPin" error={errors.taxPin}>
            <Input id="taxPin" name="taxPin" defaultValue={values?.taxPin} placeholder="P051234567X" />
          </Field>

          <Field
            label="Credit limit (KES)"
            htmlFor="creditLimit"
            hint="Leave at 0 for cash-only customers."
            error={errors.creditLimit}
          >
            <Input
              id="creditLimit"
              name="creditLimit"
              type="number"
              min={0}
              step="0.01"
              defaultValue={values?.creditLimit ?? 0}
              className="tabular"
            />
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
            Active — this customer can be selected at the till
          </label>
        </div>
      </Card>

      <div className="flex gap-3">
        <Link href="/sales/customers">
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
