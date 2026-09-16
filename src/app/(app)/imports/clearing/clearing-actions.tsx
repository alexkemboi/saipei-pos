'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { updateShipmentStatus } from '../actions'

/** Moves a container to the next clearing state from the clearing worklist. */
export function ClearingActions({
  shipmentId,
  status,
}: {
  shipmentId: string
  status: string
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const next =
    status === 'DEPARTED'
      ? { status: 'ARRIVED', label: 'Mark arrived' }
      : status === 'ARRIVED'
        ? { status: 'CLEARED', label: 'Mark released' }
        : null

  if (!next) {
    return <span className="text-xs text-saipei-gray-400">—</span>
  }

  return (
    <div>
      <Button
        size="sm"
        variant="secondary"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const result = await updateShipmentStatus({
              shipmentId,
              status: next.status,
              actualArrival: new Date().toISOString().slice(0, 10),
            })
            if (result.error) setError(result.error)
          })
        }
      >
        {isPending ? 'Saving…' : next.label}
      </Button>
      {error ? (
        <p className="mt-1 text-xs font-medium text-saipei-red-700">{error}</p>
      ) : null}
    </div>
  )
}
