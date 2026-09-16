'use client'

import { useState, useTransition } from 'react'
import { LockKeyhole, PiggyBank } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Textarea } from '@/components/ui/form'
import { formatKes } from '@/lib/utils'
import { closeCashSession, openCashSession } from '../actions'

export interface OpenSession {
  id: string
  reference: string
  openingFloat: number
  cashTaken: number
  expected: number
}

export function CashSessionPanel({ session }: { session: OpenSession | null }) {
  const [state, setState] = useState<{ error?: string; success?: string }>({})
  const [isPending, startTransition] = useTransition()
  const [float, setFloat] = useState('')
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')

  const countedValue = Number(counted) || 0
  const variance = session ? countedValue - session.expected : 0

  if (!session) {
    return (
      <Card>
        <CardHeader
          title="Open a till session"
          description="Count the float into the drawer before the first sale of the shift."
        />

        {state.error ? (
          <div className="mb-4">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}
        {state.success ? (
          <div className="mb-4">
            <Alert tone="success" title="Session open">
              {state.success}
            </Alert>
          </div>
        ) : null}

        <div className="max-w-sm">
          <Field label="Opening float (KES)" htmlFor="openingFloat" required>
            <Input
              id="openingFloat"
              type="number"
              min={0}
              step="0.01"
              value={float}
              onChange={(e) => setFloat(e.target.value)}
              className="tabular h-12 text-lg"
            />
          </Field>
        </div>

        <Button
          size="lg"
          className="mt-4"
          disabled={isPending || float === ''}
          onClick={() =>
            startTransition(async () => {
              setState({})
              const result = await openCashSession(Number(float) || 0)
              setState(result)
              if (result.success) setFloat('')
            })
          }
          icon={<PiggyBank className="h-4 w-4" aria-hidden />}
        >
          {isPending ? 'Opening…' : 'Open session'}
        </Button>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title={`Session ${session.reference} is open`}
        description="Count the drawer and close the session at the end of the shift."
      />

      {state.error ? (
        <div className="mb-4">
          <Alert tone="danger">{state.error}</Alert>
        </div>
      ) : null}
      {state.success ? (
        <div className="mb-4">
          <Alert tone="success" title="Session closed">
            {state.success}
          </Alert>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Figure label="Opening float" value={formatKes(session.openingFloat)} />
        <Figure label="Cash taken this session" value={formatKes(session.cashTaken)} />
        <Figure
          label="Expected in the drawer"
          value={formatKes(session.expected)}
          emphasis
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Cash counted (KES)" htmlFor="counted" required>
          <Input
            id="counted"
            type="number"
            min={0}
            step="0.01"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            className="tabular h-12 text-lg"
          />
        </Field>

        <Field label="Notes" htmlFor="close-notes">
          <Textarea
            id="close-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything that explains a difference"
          />
        </Field>
      </div>

      {counted !== '' ? (
        <div
          className={
            'mt-4 flex items-baseline justify-between rounded-md border px-4 py-3 ' +
            (variance === 0
              ? 'border-saipei-green-200 bg-saipei-green-50'
              : variance > 0
                ? 'border-saipei-amber-200 bg-saipei-amber-50'
                : 'border-saipei-red-200 bg-saipei-red-50')
          }
        >
          <span
            className={
              'font-semibold ' +
              (variance === 0
                ? 'text-saipei-green-800'
                : variance > 0
                  ? 'text-saipei-amber-700'
                  : 'text-saipei-red-700')
            }
          >
            {variance === 0
              ? 'Balanced exactly'
              : variance > 0
                ? 'Over by'
                : 'Short by'}
          </span>
          <span
            className={
              'tabular text-2xl font-bold ' +
              (variance === 0
                ? 'text-saipei-green-700'
                : variance > 0
                  ? 'text-saipei-amber-700'
                  : 'text-saipei-red-600')
            }
          >
            {formatKes(Math.abs(variance))}
          </span>
        </div>
      ) : null}

      <Button
        size="lg"
        variant="secondary"
        className="mt-5"
        disabled={isPending || counted === ''}
        onClick={() =>
          startTransition(async () => {
            setState({})
            const result = await closeCashSession({
              sessionId: session.id,
              countedCash: countedValue,
              notes: notes || undefined,
            })
            setState(result)
            if (result.success) {
              setCounted('')
              setNotes('')
            }
          })
        }
        icon={<LockKeyhole className="h-4 w-4" aria-hidden />}
      >
        {isPending ? 'Closing…' : 'Close session'}
      </Button>
    </Card>
  )
}

function Figure({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div
      className={
        'rounded-md border px-4 py-3 ' +
        (emphasis
          ? 'border-saipei-dark-200 bg-saipei-dark-50'
          : 'border-saipei-gray-200 bg-saipei-gray-50')
      }
    >
      <p className="text-xs font-semibold tracking-wider text-saipei-gray-500 uppercase">
        {label}
      </p>
      <p className="tabular mt-0.5 text-xl font-bold text-saipei-dark-800">{value}</p>
    </div>
  )
}
