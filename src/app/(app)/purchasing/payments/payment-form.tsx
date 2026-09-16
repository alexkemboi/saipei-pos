'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Banknote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Select, Textarea } from '@/components/ui/form'
import { formatKes, formatNumber } from '@/lib/utils'
import { createSupplierPayment, type FormState } from '../actions'

const EMPTY: FormState = {}

export interface PayableInvoice {
  id: string
  supplierId: string
  label: string
  balance: number
  currency: string
  exchangeRate: number
}

export function SupplierPaymentForm({
  suppliers,
  invoices,
}: {
  suppliers: { id: string; name: string; currency: string }[]
  invoices: PayableInvoice[]
}) {
  const [state, formAction] = useActionState(createSupplierPayment, EMPTY)
  const errors = state.fieldErrors ?? {}

  const [supplierId, setSupplierId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [method, setMethod] = useState('BANK_TRANSFER')
  const [currency, setCurrency] = useState('USD')
  const [rate, setRate] = useState('129')
  const [amount, setAmount] = useState('')

  const relevant = invoices.filter((invoice) => invoice.supplierId === supplierId)
  const selected = relevant.find((invoice) => invoice.id === invoiceId) ?? null
  const kes = (Number(amount) || 0) * (Number(rate) || 0)

  return (
    <form action={formAction}>
      <Card>
        <CardHeader
          title="Pay a supplier"
          description="Record a deposit against an order, or settle an invoice."
        />

        {state.error ? (
          <div className="mb-4">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}
        {state.success ? (
          <div className="mb-4">
            <Alert tone="success" title="Payment recorded">
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
                setInvoiceId('')
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

          <Field
            label="Against invoice"
            htmlFor="supplierInvoiceId"
            hint="Leave blank for a deposit."
            className="sm:col-span-2"
          >
            <Select
              id="supplierInvoiceId"
              name="supplierInvoiceId"
              value={invoiceId}
              onChange={(e) => {
                setInvoiceId(e.target.value)
                const invoice = relevant.find((i) => i.id === e.target.value)
                if (invoice) {
                  setCurrency(invoice.currency)
                  setRate(String(invoice.exchangeRate))
                  setAmount(String(invoice.balance))
                }
              }}
              disabled={!supplierId}
            >
              <option value="">No specific invoice (deposit)</option>
              {relevant.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.label} — {invoice.currency}{' '}
                  {formatNumber(invoice.balance, 2)} outstanding
                </option>
              ))}
            </Select>
          </Field>

          {selected ? (
            <div className="rounded-md border border-saipei-red-200 bg-saipei-red-50 px-4 py-3 sm:col-span-2">
              <p className="text-xs font-semibold tracking-wider text-saipei-red-700 uppercase">
                Outstanding on this invoice
              </p>
              <p className="tabular mt-0.5 text-2xl font-bold text-saipei-red-600">
                {selected.currency} {formatNumber(selected.balance, 2)}
              </p>
            </div>
          ) : null}

          <Field label="Method" htmlFor="method" required>
            <Select
              id="method"
              name="method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="MPESA">M-PESA</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
            </Select>
          </Field>

          <Field label="Payment date" htmlFor="paymentDate">
            <Input
              id="paymentDate"
              name="paymentDate"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
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

          {method === 'MPESA' ? (
            <Field label="M-PESA code" htmlFor="mpesaCode">
              <Input id="mpesaCode" name="mpesaCode" className="tabular" />
            </Field>
          ) : (
            <Field
              label={method === 'CHEQUE' ? 'Cheque number' : 'Bank reference'}
              htmlFor="bankReference"
            >
              <Input id="bankReference" name="bankReference" className="tabular" />
            </Field>
          )}

          <Field label="Notes" htmlFor="notes" className="lg:col-span-2">
            <Textarea id="notes" name="notes" rows={2} />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-md border border-saipei-gray-200 bg-saipei-gray-50 px-4 py-3">
          <div>
            <p className="text-xs font-semibold tracking-wider text-saipei-gray-500 uppercase">
              Payment in shillings
            </p>
            <p className="tabular mt-0.5 text-2xl font-bold text-saipei-dark-800">
              {formatKes(kes)}
            </p>
          </div>
          <label className="flex items-center gap-2.5 text-sm text-saipei-gray-700">
            <input
              type="checkbox"
              name="isDeposit"
              className="h-4 w-4 rounded border-saipei-gray-300 accent-[var(--saipei-green)]"
            />
            This is a deposit against an order
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
    <Button type="submit" disabled={pending} icon={<Banknote className="h-4 w-4" aria-hidden />}>
      {pending ? 'Recording…' : 'Record payment'}
    </Button>
  )
}
