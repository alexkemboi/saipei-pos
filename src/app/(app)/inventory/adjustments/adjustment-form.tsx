'use client'

import { useMemo, useState, useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Select, Textarea } from '@/components/ui/form'
import { LineEditor, newLine, type EditableLine } from '@/components/ui/line-editor'
import { createStockAdjustment } from '../movements-actions'

const REASONS = [
  { value: 'DAMAGE', label: 'Damaged goods' },
  { value: 'LOSS', label: 'Loss' },
  { value: 'THEFT', label: 'Theft' },
  { value: 'EXPIRY', label: 'Expiry' },
  { value: 'COUNT_CORRECTION', label: 'Count correction' },
  { value: 'OPENING_BALANCE', label: 'Opening balance' },
  { value: 'OTHER', label: 'Other' },
]

export interface AdjustmentProduct {
  id: string
  sku: string
  name: string
  stockByWarehouse: Record<string, number>
}

export function StockAdjustmentForm({
  warehouses,
  products,
}: {
  warehouses: { id: string; name: string }[]
  products: AdjustmentProduct[]
}) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '')
  const [reason, setReason] = useState('DAMAGE')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<EditableLine[]>([newLine()])
  const [state, setState] = useState<{ error?: string; success?: string }>({})
  const [isPending, startTransition] = useTransition()

  const withStock = useMemo(
    () =>
      products.map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        quantity: product.stockByWarehouse[warehouseId] ?? 0,
      })),
    [products, warehouseId],
  )

  function submit() {
    setState({})
    startTransition(async () => {
      const result = await createStockAdjustment({
        warehouseId,
        reason: reason as 'DAMAGE',
        notes: notes || undefined,
        lines: lines
          .filter((line) => line.productId && Number(line.quantity) !== 0)
          .map((line) => ({
            productId: line.productId,
            quantity: Number(line.quantity),
          })),
      })
      setState(result)
      if (result.success) {
        setLines([newLine()])
        setNotes('')
      }
    })
  }

  const ready = lines.some((line) => line.productId && Number(line.quantity) !== 0)

  return (
    <div className="space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="success" title="Adjustment posted">
          {state.success}
        </Alert>
      ) : null}

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Adjust stock"
            description="Use a negative quantity to write stock off and a positive one to add it back."
          />
          <div className="grid grid-cols-1 gap-4 pb-4 sm:grid-cols-2">
            <Field label="Warehouse" htmlFor="warehouseId" required>
              <Select
                id="warehouseId"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Reason" htmlFor="reason" required>
              <Select id="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <LineEditor
          lines={lines}
          products={withStock}
          onChange={setLines}
          allowNegative
          quantityLabel="Adjustment"
          availabilityLabel="On hand"
        />

        <div className="space-y-4 border-t border-saipei-gray-200 px-5 py-5">
          <Field
            label="Notes"
            htmlFor="adjustment-notes"
            hint="Adjustments are permanent and appear in the audit trail."
          >
            <Textarea
              id="adjustment-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What happened, and who authorised the write-off"
            />
          </Field>

          <Button
            size="lg"
            variant={lines.some((l) => Number(l.quantity) < 0) ? 'danger' : 'primary'}
            onClick={submit}
            disabled={isPending || !ready}
            icon={<RefreshCw className="h-4 w-4" aria-hidden />}
          >
            {isPending ? 'Posting…' : 'Post adjustment'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
