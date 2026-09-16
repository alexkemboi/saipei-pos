'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Select } from '@/components/ui/form'
import { createExpense, type FormState } from '../actions'

const EMPTY: FormState = {}

export function ExpenseForm({
  categories,
}: {
  categories: { id: string; name: string }[]
}) {
  const [state, formAction] = useActionState(createExpense, EMPTY)
  const errors = state.fieldErrors ?? {}

  return (
    <form action={formAction}>
      <Card>
        <CardHeader
          title="Record an expense"
          description="Anything paid out that is not a supplier invoice or import charge."
        />

        {state.error ? (
          <div className="mb-4">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}
        {state.success ? (
          <div className="mb-4">
            <Alert tone="success" title="Expense recorded">
              {state.success}
            </Alert>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Category" htmlFor="categoryId" required error={errors.categoryId}>
            <Select id="categoryId" name="categoryId" required>
              <option value="">Choose a category…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
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
              placeholder="e.g. Fuel for the delivery van"
              invalid={Boolean(errors.description)}
              required
            />
          </Field>

          <Field label="Amount (KES)" htmlFor="amount" required error={errors.amount}>
            <Input
              id="amount"
              name="amount"
              type="number"
              min={0.01}
              step="0.01"
              className="tabular"
              invalid={Boolean(errors.amount)}
              required
            />
          </Field>

          <Field label="Paid by" htmlFor="method" required>
            <Select id="method" name="method" defaultValue="CASH">
              <option value="CASH">Cash</option>
              <option value="MPESA">M-PESA</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CARD">Card</option>
            </Select>
          </Field>

          <Field label="Date" htmlFor="expenseDate">
            <Input
              id="expenseDate"
              name="expenseDate"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </Field>

          <Field label="Payee" htmlFor="payeeName" className="sm:col-span-2">
            <Input id="payeeName" name="payeeName" placeholder="Who was paid" />
          </Field>
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
    <Button type="submit" disabled={pending} icon={<Receipt className="h-4 w-4" aria-hidden />}>
      {pending ? 'Saving…' : 'Record expense'}
    </Button>
  )
}
