'use client'

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { Alert } from '@/components/ui/form'
import { cn, humanize } from '@/lib/utils'
import { setImportStage } from '../actions'

const STAGES = [
  'ORDER_PLACED',
  'SUPPLIER_INVOICED',
  'DEPOSIT_PAID',
  'DOCUMENTATION',
  'LOADED',
  'IN_TRANSIT',
  'ARRIVED',
  'CLEARING',
  'RELEASED',
  'RECEIVED',
  'CLOSED',
]

/**
 * The import pipeline as a clickable stepper. Completed stages are SAIPEI
 * green with a tick; the current one is dark green; the rest are neutral — so
 * progress reads without relying on colour alone.
 */
export function StageStepper({
  importOrderId,
  stage,
  canEdit,
}: {
  importOrderId: string
  stage: string
  canEdit: boolean
}) {
  const [current, setCurrent] = useState(stage)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const currentIndex = STAGES.indexOf(current)

  function move(next: string) {
    if (!canEdit || next === current) return
    const previous = current
    setCurrent(next)
    setError(null)

    startTransition(async () => {
      const result = await setImportStage({ importOrderId, stage: next })
      if (result.error) {
        setCurrent(previous) // put it back if the server refused
        setError(result.error)
      }
    })
  }

  return (
    <div>
      {error ? (
        <div className="mb-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}

      <ol className="flex flex-wrap gap-2">
        {STAGES.map((item, index) => {
          const done = index < currentIndex
          const isCurrent = index === currentIndex

          return (
            <li key={item}>
              <button
                type="button"
                onClick={() => move(item)}
                disabled={!canEdit || isPending}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors',
                  isCurrent &&
                    'border-saipei-dark-700 bg-saipei-dark-700 text-white',
                  done &&
                    'border-saipei-green-300 bg-saipei-green-50 text-saipei-green-800',
                  !done &&
                    !isCurrent &&
                    'border-saipei-gray-200 bg-white text-saipei-gray-500',
                  canEdit && !isCurrent && 'hover:border-saipei-green-400',
                  !canEdit && 'cursor-default',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                {humanize(item)}
              </button>
            </li>
          )
        })}
      </ol>

      {canEdit ? (
        <p className="mt-3 text-xs text-saipei-gray-500">
          Select a stage to move this consignment along. Every change is recorded in
          the audit trail.
        </p>
      ) : null}
    </div>
  )
}
