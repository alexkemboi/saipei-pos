'use client'

import { useState, useTransition } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form'
import { decidePurchaseOrder } from '../actions'

/**
 * Approve or reject in place. Rejection asks for a reason first — a rejected
 * order without one is no use to whoever raised it.
 */
export function ApprovalActions({ purchaseOrderId }: { purchaseOrderId: string }) {
  const [rejecting, setRejecting] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function decide(approve: boolean) {
    setError(null)
    startTransition(async () => {
      const result = await decidePurchaseOrder({
        purchaseOrderId,
        approve,
        notes: notes || undefined,
      })
      if (result.error) setError(result.error)
      else setRejecting(false)
    })
  }

  if (rejecting) {
    return (
      <div className="space-y-2">
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Reason for rejection"
          aria-label="Reason for rejection"
          className="w-48"
          autoFocus
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="danger"
            disabled={isPending || !notes.trim()}
            onClick={() => decide(false)}
          >
            Confirm reject
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
            Cancel
          </Button>
        </div>
        {error ? (
          <p className="text-xs font-medium text-saipei-red-700">{error}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => decide(true)}
          icon={<Check className="h-3.5 w-3.5" aria-hidden />}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={isPending}
          onClick={() => setRejecting(true)}
          icon={<X className="h-3.5 w-3.5" aria-hidden />}
        >
          Reject
        </Button>
      </div>
      {error ? (
        <p className="mt-1 text-xs font-medium text-saipei-red-700">{error}</p>
      ) : null}
    </div>
  )
}
