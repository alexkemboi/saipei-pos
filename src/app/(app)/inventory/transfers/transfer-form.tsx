'use client'

import { useMemo, useState, useTransition } from 'react'
import { Repeat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Select, Textarea } from '@/components/ui/form'
import { LineEditor, newLine, type EditableLine } from '@/components/ui/line-editor'
import { createStockTransfer } from '../movements-actions'

export interface TransferProduct {
  id: string
  sku: string
  name: string
  stockByWarehouse: Record<string, number>
}

export function StockTransferForm({
  warehouses,
  products,
}: {
  warehouses: { id: string; name: string }[]
  products: TransferProduct[]
}) {
  const [fromWarehouseId, setFrom] = useState(warehouses[0]?.id ?? '')
  const [toWarehouseId, setTo] = useState(warehouses[1]?.id ?? '')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<EditableLine[]>([newLine()])
  const [state, setState] = useState<{ error?: string; success?: string }>({})
  const [isPending, startTransition] = useTransition()

  // Only offer stock the sending warehouse actually holds.
  const available = useMemo(
    () =>
      products
        .map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          quantity: product.stockByWarehouse[fromWarehouseId] ?? 0,
        }))
        .filter((product) => product.quantity > 0),
    [products, fromWarehouseId],
  )

  function submit() {
    setState({})
    startTransition(async () => {
      const result = await createStockTransfer({
        fromWarehouseId,
        toWarehouseId,
        notes: notes || undefined,
        lines: lines
          .filter((line) => line.productId && Number(line.quantity) > 0)
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

  const ready =
    fromWarehouseId !== toWarehouseId &&
    lines.some((line) => line.productId && Number(line.quantity) > 0)

  return (
    <div className="space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="success" title="Transfer completed">
          {state.success}
        </Alert>
      ) : null}

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Move stock between warehouses"
            description="Stock leaves one store and arrives in the other immediately."
          />
          <div className="grid grid-cols-1 gap-4 pb-4 sm:grid-cols-2">
            <Field label="From warehouse" htmlFor="fromWarehouseId" required>
              <Select
                id="fromWarehouseId"
                value={fromWarehouseId}
                onChange={(e) => {
                  setFrom(e.target.value)
                  setLines([newLine()])
                }}
              >
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="To warehouse"
              htmlFor="toWarehouseId"
              required
              error={
                fromWarehouseId === toWarehouseId
                  ? 'Choose two different warehouses.'
                  : undefined
              }
            >
              <Select
                id="toWarehouseId"
                value={toWarehouseId}
                onChange={(e) => setTo(e.target.value)}
                invalid={fromWarehouseId === toWarehouseId}
              >
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <LineEditor
          lines={lines}
          products={available}
          onChange={setLines}
          quantityLabel="Transfer qty"
          availabilityLabel="Available"
        />

        <div className="space-y-4 border-t border-saipei-gray-200 px-5 py-5">
          <Field label="Notes" htmlFor="transfer-notes">
            <Textarea
              id="transfer-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Who is moving the stock, and why"
            />
          </Field>

          <Button
            size="lg"
            onClick={submit}
            disabled={isPending || !ready}
            icon={<Repeat className="h-4 w-4" aria-hidden />}
          >
            {isPending ? 'Transferring…' : 'Complete transfer'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
