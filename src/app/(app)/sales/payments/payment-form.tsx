'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Select, Textarea } from '@/components/ui/form'
import { formatKes } from '@/lib/utils'
import { recordCustomerPayment, type PaymentState } from './actions'

const EMPTY: PaymentState = {}

export function CustomerPaymentForm({
  customers,
}: {
  customers: { id: string; name: string; code: string; balance: number }[]
}) {
  const [state, formAction] = useActionState(recordCustomerPayment, EMPTY)
  const [customerId, setCustomerId] = useState('')
  const [method, setMethod] = useState('CASH')

  const selected = customers.find((c) => c.id === customerId) ?? null

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="success" title="Payment recorded">
          {state.success}
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Receive a payment"
          description="Applied to the customer's oldest unsettled credit sales first."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer" htmlFor="customerId" required className="sm:col-span-2">
            <Select
              id="customerId"
              name="customerId"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              <option value="">Choose a customer…</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} — owes {formatKes(customer.balance)}
                </option>
              ))}
            </Select>
          </Field>

          {selected ? (
            <div className="rounded-md border border-saipei-red-200 bg-saipei-red-50 px-4 py-3 sm:col-span-2">
              <p className="text-xs font-semibold tracking-wider text-saipei-red-700 uppercase">
                Outstanding balance
              </p>
              <p className="tabular mt-0.5 text-2xl font-bold text-saipei-red-600">
                {formatKes(selected.balance)}
              </p>
            </div>
          ) : null}

          <Field label="Amount received (KES)" htmlFor="amount" required>
            <Input
              id="amount"
              name="amount"
              type="number"
              min={0.01}
              step="0.01"
              max={selected?.balance}
              className="tabular h-12 text-lg"
              required
            />
          </Field>

          <Field label="Method" htmlFor="method" required>
            <Select
              id="method"
              name="method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="h-12"
            >
              <option value="CASH">Cash</option>
              <option value="MPESA">M-PESA</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CARD">Card</option>
            </Select>
          </Field>

          {method === 'MPESA' ? (
            <Field
              label="M-PESA code"
              htmlFor="mpesaCode"
              hint="From the customer's confirmation SMS."
              className="sm:col-span-2"
            >
              <Input id="mpesaCode" name="mpesaCode" className="tabular" placeholder="e.g. SFH4K2LMN9" />
            </Field>
          ) : null}

          {method === 'BANK_TRANSFER' || method === 'CHEQUE' ? (
            <Field
              label={method === 'CHEQUE' ? 'Cheque number' : 'Bank reference'}
              htmlFor="bankReference"
              className="sm:col-span-2"
            >
              <Input id="bankReference" name="bankReference" className="tabular" />
            </Field>
          ) : null}

          <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
            <Textarea id="notes" name="notes" rows={2} />
          </Field>
        </div>

        <div className="mt-5">
          <SubmitButton disabled={!customerId} />
        </div>
      </Card>
    </form>
  )
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending || disabled}
      icon={<Wallet className="h-4 w-4" aria-hidden />}
    >
      {pending ? 'Recording…' : 'Record payment'}
    </Button>
  )
}
