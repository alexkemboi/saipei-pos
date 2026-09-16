'use client'

import { useState, useTransition } from 'react'
import { PackageCheck, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Select, Textarea } from '@/components/ui/form'
import { formatKes } from '@/lib/utils'
import { createGoodsReceipt } from './actions'

interface BaleRow {
  key: string
  baleNumber: string
  shoeType: string
  weightKg: string
  balePrice: string
  piecesEstimate: string
  productId: string
}

function emptyBale(index: number): BaleRow {
  return {
    key: `bale-${Date.now()}-${index}`,
    baleNumber: '',
    shoeType: '',
    weightKg: '',
    balePrice: '',
    piecesEstimate: '',
    productId: '',
  }
}

export function GoodsReceiptForm({
  warehouses,
  products,
  shipments,
}: {
  warehouses: { id: string; name: string; code: string }[]
  products: { id: string; sku: string; name: string }[]
  shipments: { id: string; reference: string; containerNumber: string | null }[]
}) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '')
  const [shipmentId, setShipmentId] = useState('')
  const [containerNumber, setContainerNumber] = useState('')
  const [receiptDate, setReceiptDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [verifiedBy, setVerifiedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [containerCost, setContainerCost] = useState('')
  const [offloadingCost, setOffloadingCost] = useState('')
  const [transportCost, setTransportCost] = useState('')
  const [warehouseCost, setWarehouseCost] = useState('')
  const [bales, setBales] = useState<BaleRow[]>([emptyBale(0)])
  const [state, setState] = useState<{ error?: string; success?: string }>({})
  const [isPending, startTransition] = useTransition()

  const num = (value: string) => Number(value) || 0

  const balesValue = bales.reduce((sum, b) => sum + num(b.balePrice), 0)
  const extraCosts =
    num(containerCost) + num(offloadingCost) + num(transportCost) + num(warehouseCost)
  const landedTotal = balesValue + extraCosts
  const totalWeight = bales.reduce((sum, b) => sum + num(b.weightKg), 0)
  const totalPieces = bales.reduce((sum, b) => sum + num(b.piecesEstimate), 0)

  function updateBale(key: string, patch: Partial<BaleRow>) {
    setBales((current) =>
      current.map((bale) => (bale.key === key ? { ...bale, ...patch } : bale)),
    )
  }

  function submit() {
    setState({})
    startTransition(async () => {
      const result = await createGoodsReceipt({
        warehouseId,
        shipmentId: shipmentId || undefined,
        containerNumber: containerNumber || undefined,
        receiptDate,
        verifiedBy: verifiedBy || undefined,
        notes: notes || undefined,
        containerCost: num(containerCost),
        offloadingCost: num(offloadingCost),
        transportCost: num(transportCost),
        warehouseCost: num(warehouseCost),
        bales: bales.map((bale) => ({
          baleNumber: bale.baleNumber.trim(),
          shoeType: bale.shoeType.trim(),
          weightKg: num(bale.weightKg),
          balePrice: num(bale.balePrice),
          piecesEstimate: Math.round(num(bale.piecesEstimate)),
          productId: bale.productId || undefined,
        })),
      })

      setState(result)
      if (result.success) {
        setBales([emptyBale(0)])
        setContainerNumber('')
        setContainerCost('')
        setOffloadingCost('')
        setTransportCost('')
        setWarehouseCost('')
        setNotes('')
      }
    })
  }

  return (
    <div className="space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="success" title="Goods received">
          {state.success}
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Consignment"
          description="Where the goods are being received and which shipment they came on."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Receiving warehouse" htmlFor="warehouseId" required>
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

          <Field label="Against shipment" htmlFor="shipmentId" hint="Optional for local purchases.">
            <Select
              id="shipmentId"
              value={shipmentId}
              onChange={(e) => {
                setShipmentId(e.target.value)
                const shipment = shipments.find((s) => s.id === e.target.value)
                if (shipment?.containerNumber) setContainerNumber(shipment.containerNumber)
              }}
            >
              <option value="">No shipment</option>
              {shipments.map((shipment) => (
                <option key={shipment.id} value={shipment.id}>
                  {shipment.reference}
                  {shipment.containerNumber ? ` — ${shipment.containerNumber}` : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Container number" htmlFor="containerNumber">
            <Input
              id="containerNumber"
              value={containerNumber}
              onChange={(e) => setContainerNumber(e.target.value.toUpperCase())}
              className="tabular"
              placeholder="e.g. MSKU1234567"
            />
          </Field>

          <Field label="Date received" htmlFor="receiptDate" required>
            <Input
              id="receiptDate"
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
            />
          </Field>

          <Field label="Verified by" htmlFor="verifiedBy" hint="Who counted the goods in.">
            <Input
              id="verifiedBy"
              value={verifiedBy}
              onChange={(e) => setVerifiedBy(e.target.value)}
            />
          </Field>
        </div>
      </Card>

      {/* ---------------- Bales ---------------- */}
      <Card padded={false}>
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
          <div>
            <h2 className="text-base font-semibold text-saipei-dark-800">Bales received</h2>
            <p className="mt-0.5 text-sm text-saipei-gray-500">
              Capture each bale: number, type of shoes, weight and price.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setBales((current) => [...current, emptyBale(current.length)])}
            icon={<Plus className="h-4 w-4" aria-hidden />}
          >
            Add bale
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-saipei-gray-200 bg-saipei-gray-50">
              <tr>
                {[
                  'Bale no.',
                  'Type of shoes',
                  'Weight (kg)',
                  'Bale price (KES)',
                  'Pieces',
                  'Stock item',
                  '',
                ].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-saipei-dark-700 uppercase whitespace-nowrap"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-saipei-gray-100">
              {bales.map((bale, index) => (
                <tr key={bale.key}>
                  <td className="px-3 py-2">
                    <Input
                      value={bale.baleNumber}
                      onChange={(e) => updateBale(bale.key, { baleNumber: e.target.value })}
                      placeholder={`BALE-${index + 1}`}
                      aria-label={`Bale number for row ${index + 1}`}
                      className="tabular w-32"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={bale.shoeType}
                      onChange={(e) => updateBale(bale.key, { shoeType: e.target.value })}
                      placeholder="e.g. Men's leather"
                      aria-label={`Shoe type for row ${index + 1}`}
                      className="w-44"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={bale.weightKg}
                      onChange={(e) => updateBale(bale.key, { weightKg: e.target.value })}
                      aria-label={`Weight for row ${index + 1}`}
                      className="tabular w-24 text-right"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={bale.balePrice}
                      onChange={(e) => updateBale(bale.key, { balePrice: e.target.value })}
                      aria-label={`Bale price for row ${index + 1}`}
                      className="tabular w-32 text-right"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="1"
                      value={bale.piecesEstimate}
                      onChange={(e) =>
                        updateBale(bale.key, { piecesEstimate: e.target.value })
                      }
                      aria-label={`Pieces for row ${index + 1}`}
                      className="tabular w-24 text-right"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={bale.productId}
                      onChange={(e) => updateBale(bale.key, { productId: e.target.value })}
                      aria-label={`Stock item for row ${index + 1}`}
                      className="w-56"
                    >
                      <option value="">Not stocked yet</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} — {product.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        setBales((current) =>
                          current.length === 1
                            ? current
                            : current.filter((b) => b.key !== bale.key),
                        )
                      }
                      disabled={bales.length === 1}
                      aria-label={`Remove row ${index + 1}`}
                      className="rounded p-1.5 text-saipei-gray-400 hover:bg-saipei-red-50 hover:text-saipei-red-600 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="border-t border-saipei-gray-200 px-5 py-3 text-xs text-saipei-gray-500">
          A bale without a stock item is recorded and costed, but nothing is added to
          sellable stock until it is linked to a product.
        </p>
      </Card>

      {/* ---------------- Charges + summary ---------------- */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader
            title="Charges on arrival"
            description="Spread across the bales by value to give the true landed cost."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Cost of container (KES)" htmlFor="containerCost">
              <Input
                id="containerCost"
                type="number"
                min={0}
                step="0.01"
                value={containerCost}
                onChange={(e) => setContainerCost(e.target.value)}
                className="tabular"
              />
            </Field>
            <Field label="Offloading charges (KES)" htmlFor="offloadingCost">
              <Input
                id="offloadingCost"
                type="number"
                min={0}
                step="0.01"
                value={offloadingCost}
                onChange={(e) => setOffloadingCost(e.target.value)}
                className="tabular"
              />
            </Field>
            <Field label="Transport (KES)" htmlFor="transportCost">
              <Input
                id="transportCost"
                type="number"
                min={0}
                step="0.01"
                value={transportCost}
                onChange={(e) => setTransportCost(e.target.value)}
                className="tabular"
              />
            </Field>
            <Field label="Warehouse charges (KES)" htmlFor="warehouseCost">
              <Input
                id="warehouseCost"
                type="number"
                min={0}
                step="0.01"
                value={warehouseCost}
                onChange={(e) => setWarehouseCost(e.target.value)}
                className="tabular"
              />
            </Field>
            <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
              <Textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Condition on arrival, discrepancies against the packing list…"
              />
            </Field>
          </div>
        </Card>

        <Card className="self-start">
          <CardHeader title="Receipt summary" />
          <dl className="space-y-2 text-sm">
            <Row label="Bales" value={String(bales.length)} />
            <Row label="Total weight" value={`${totalWeight.toFixed(2)} kg`} />
            <Row label="Estimated pieces" value={String(totalPieces)} />
            <Row label="Value of bales" value={formatKes(balesValue)} />
            <Row label="Charges on arrival" value={formatKes(extraCosts)} />
            <div className="flex items-baseline justify-between border-t border-saipei-gray-200 pt-2.5">
              <dt className="font-semibold text-saipei-dark-800">Total landed cost</dt>
              <dd className="tabular text-xl font-bold text-saipei-dark-800">
                {formatKes(landedTotal)}
              </dd>
            </div>
            {totalPieces > 0 ? (
              <Row
                label="Average cost per piece"
                value={formatKes(landedTotal / totalPieces)}
              />
            ) : null}
          </dl>

          <Button
            size="lg"
            fullWidth
            className="mt-5"
            onClick={submit}
            disabled={isPending || bales.length === 0}
            icon={<PackageCheck className="h-4 w-4" aria-hidden />}
          >
            {isPending ? 'Posting…' : 'Receive into stock'}
          </Button>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-saipei-gray-500">{label}</dt>
      <dd className="tabular font-medium text-saipei-gray-900">{value}</dd>
    </div>
  )
}
