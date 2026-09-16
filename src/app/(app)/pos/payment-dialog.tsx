'use client'

import { useState } from 'react'
import {
  Banknote,
  CreditCard,
  Landmark,
  Smartphone,
  UserRound,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, Field, Input } from '@/components/ui/form'
import { cn, formatKes } from '@/lib/utils'

type Method = 'CASH' | 'MPESA' | 'BANK_TRANSFER' | 'CARD' | 'CREDIT'

const METHODS: { value: Method; label: string; icon: typeof Banknote }[] = [
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'MPESA', label: 'M-PESA', icon: Smartphone },
  { value: 'CARD', label: 'Card', icon: CreditCard },
  { value: 'BANK_TRANSFER', label: 'Bank', icon: Landmark },
]

/** Quick-tender notes a Kenyan till actually holds. */
const QUICK_NOTES = [50, 100, 200, 500, 1000]

export function PaymentDialog({
  total,
  customerName,
  canSellOnCredit,
  isPending,
  onCancel,
  onConfirm,
}: {
  total: number
  customerName: string | null
  canSellOnCredit: boolean
  isPending: boolean
  onCancel: () => void
  onConfirm: (payload: {
    method: Method
    amountTendered: number
    mpesaCode?: string
  }) => void
}) {
  const [method, setMethod] = useState<Method>('CASH')
  const [tendered, setTendered] = useState<string>(String(total))
  const [mpesaCode, setMpesaCode] = useState('')

  const tenderedValue = Number(tendered) || 0
  const change = Math.max(0, tenderedValue - total)
  const short = method === 'CASH' && tenderedValue < total

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-saipei-dark-950/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-[var(--radius-card)] bg-white shadow-xl">
        {/* Dark green structural header, amount payable in brand red */}
        <div className="flex items-start justify-between bg-saipei-dark-700 px-5 py-4">
          <div>
            <h2 id="payment-title" className="text-lg font-semibold text-white">
              Take payment
            </h2>
            <p className="text-sm text-saipei-green-200">
              {customerName ?? 'Walk-in customer'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel payment"
            className="rounded-md p-1.5 text-saipei-dark-100 hover:bg-saipei-dark-600 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="rounded-lg border border-saipei-red-200 bg-saipei-red-50 px-4 py-3 text-center">
            <p className="text-xs font-semibold tracking-wider text-saipei-red-700 uppercase">
              Amount payable
            </p>
            <p className="tabular mt-1 text-3xl font-bold text-saipei-red-600">
              {formatKes(total)}
            </p>
          </div>

          {/* --- Method --- */}
          <fieldset className="mt-5">
            <legend className="mb-2 text-xs font-semibold tracking-wider text-saipei-gray-500 uppercase">
              Payment method
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {METHODS.map((option) => {
                const active = method === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setMethod(option.value)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-sm font-medium transition-colors',
                      active
                        ? 'border-saipei-green-500 bg-saipei-green-50 text-saipei-green-800'
                        : 'border-saipei-gray-300 text-saipei-gray-600 hover:border-saipei-gray-400 hover:bg-saipei-gray-50',
                    )}
                  >
                    <option.icon className="h-5 w-5" aria-hidden />
                    {option.label}
                  </button>
                )
              })}
            </div>

            {canSellOnCredit ? (
              <button
                type="button"
                aria-pressed={method === 'CREDIT'}
                onClick={() => setMethod('CREDIT')}
                className={cn(
                  'mt-2 flex w-full items-center justify-center gap-2 rounded-lg border px-2 py-3 text-sm font-medium transition-colors',
                  method === 'CREDIT'
                    ? 'border-saipei-amber-500 bg-saipei-amber-50 text-saipei-amber-700'
                    : 'border-saipei-gray-300 text-saipei-gray-600 hover:border-saipei-gray-400 hover:bg-saipei-gray-50',
                )}
              >
                <UserRound className="h-5 w-5" aria-hidden />
                Put on the customer&apos;s account (credit)
              </button>
            ) : null}
          </fieldset>

          {/* --- Method-specific inputs --- */}
          {method === 'CASH' ? (
            <div className="mt-5 space-y-3">
              <Field label="Cash received" htmlFor="tendered" required>
                <Input
                  id="tendered"
                  type="number"
                  min={0}
                  step="0.01"
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                  className="tabular h-12 text-lg"
                  invalid={short}
                  autoFocus
                />
              </Field>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTendered(String(total))}
                  className="rounded-md border border-saipei-gray-300 px-3 py-1.5 text-sm font-medium text-saipei-gray-700 hover:bg-saipei-gray-50"
                >
                  Exact
                </button>
                {QUICK_NOTES.map((note) => (
                  <button
                    key={note}
                    type="button"
                    onClick={() =>
                      setTendered(String((Number(tendered) || 0) + note))
                    }
                    className="tabular rounded-md border border-saipei-gray-300 px-3 py-1.5 text-sm font-medium text-saipei-gray-700 hover:bg-saipei-gray-50"
                  >
                    +{note}
                  </button>
                ))}
              </div>

              {short ? (
                <Alert tone="danger">
                  That is {formatKes(total - tenderedValue)} short of the amount
                  payable.
                </Alert>
              ) : (
                <div className="flex items-baseline justify-between rounded-lg border border-saipei-green-200 bg-saipei-green-50 px-4 py-3">
                  <span className="text-sm font-semibold text-saipei-green-800">
                    Change due
                  </span>
                  <span className="tabular text-xl font-bold text-saipei-green-700">
                    {formatKes(change)}
                  </span>
                </div>
              )}
            </div>
          ) : null}

          {method === 'MPESA' ? (
            <div className="mt-5 space-y-3">
              <Field
                label="M-PESA transaction code"
                htmlFor="mpesa-code"
                hint="Buy Goods till 5606927. Enter the code from the customer's confirmation SMS."
              >
                <Input
                  id="mpesa-code"
                  value={mpesaCode}
                  onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SFH4K2LMN9"
                  className="tabular h-12 text-lg tracking-wide"
                  autoFocus
                />
              </Field>
            </div>
          ) : null}

          {method === 'CREDIT' ? (
            <div className="mt-5">
              <Alert tone="warning" title="Credit sale">
                {formatKes(total)} will be added to {customerName}&apos;s account
                balance. Nothing is collected now.
              </Alert>
            </div>
          ) : null}

          {/* --- Actions --- */}
          <div className="mt-6 flex gap-3">
            <Button
              variant="neutral"
              size="lg"
              className="flex-1"
              onClick={onCancel}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              className="flex-[2]"
              disabled={isPending || short}
              onClick={() =>
                onConfirm({
                  method,
                  amountTendered: method === 'CASH' ? tenderedValue : total,
                  mpesaCode: method === 'MPESA' ? mpesaCode : undefined,
                })
              }
            >
              {isPending ? 'Saving…' : `Confirm ${formatKes(total)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
