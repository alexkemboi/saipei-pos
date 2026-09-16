'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Ship } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Select, Textarea } from '@/components/ui/form'
import { createShipment, type FormState } from '../actions'

const EMPTY: FormState = {}

export function ShipmentForm({
  orders,
  agents,
}: {
  orders: { id: string; reference: string; supplierName: string }[]
  agents: { id: string; name: string }[]
}) {
  const [state, formAction] = useActionState(createShipment, EMPTY)
  const errors = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="success" title="Shipment saved">
          {state.success}
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Loading from China"
          description="Capture the container, packing details and sailing dates."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Import order"
            htmlFor="importOrderId"
            required
            error={errors.importOrderId}
            className="lg:col-span-3"
          >
            <Select id="importOrderId" name="importOrderId" required>
              <option value="">Choose an import order…</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.reference} — {order.supplierName}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Container number" htmlFor="containerNumber">
            <Input id="containerNumber" name="containerNumber" className="tabular" placeholder="MSKU1234567" />
          </Field>

          <Field label="Bill of lading" htmlFor="billOfLading">
            <Input id="billOfLading" name="billOfLading" className="tabular" />
          </Field>

          <Field label="Vessel" htmlFor="vesselName">
            <Input id="vesselName" name="vesselName" />
          </Field>

          <Field label="Port of loading" htmlFor="portOfLoading">
            <Input id="portOfLoading" name="portOfLoading" placeholder="e.g. Shanghai" />
          </Field>

          <Field label="Clearing agent" htmlFor="clearingAgentId">
            <Select id="clearingAgentId" name="clearingAgentId">
              <option value="">Not appointed yet</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Status" htmlFor="status" required>
            <Select id="status" name="status" defaultValue="LOADED">
              <option value="PENDING">Pending</option>
              <option value="LOADED">Loaded</option>
              <option value="DEPARTED">Departed</option>
              <option value="ARRIVED">Arrived</option>
              <option value="CLEARED">Cleared</option>
              <option value="DELIVERED">Delivered</option>
            </Select>
          </Field>

          <Field label="Loading date" htmlFor="loadingDate">
            <Input id="loadingDate" name="loadingDate" type="date" />
          </Field>

          <Field label="Vessel departure" htmlFor="departureDate">
            <Input id="departureDate" name="departureDate" type="date" />
          </Field>

          <Field label="Expected arrival" htmlFor="expectedArrival">
            <Input id="expectedArrival" name="expectedArrival" type="date" />
          </Field>

          <Field label="Actual arrival" htmlFor="actualArrival">
            <Input id="actualArrival" name="actualArrival" type="date" />
          </Field>

          <Field label="Number of bales" htmlFor="numberOfBales">
            <Input
              id="numberOfBales"
              name="numberOfBales"
              type="number"
              min={0}
              step="1"
              defaultValue={0}
              className="tabular"
            />
          </Field>

          <Field label="Total weight (kg)" htmlFor="totalWeightKg">
            <Input
              id="totalWeightKg"
              name="totalWeightKg"
              type="number"
              min={0}
              step="0.01"
              defaultValue={0}
              className="tabular"
            />
          </Field>

          <Field label="Cost of container (KES)" htmlFor="containerCost">
            <Input
              id="containerCost"
              name="containerCost"
              type="number"
              min={0}
              step="0.01"
              defaultValue={0}
              className="tabular"
            />
          </Field>

          <Field label="Notes" htmlFor="notes" className="lg:col-span-3">
            <Textarea id="notes" name="notes" rows={2} placeholder="Packing list details, discrepancies…" />
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
    <Button type="submit" disabled={pending} icon={<Ship className="h-4 w-4" aria-hidden />}>
      {pending ? 'Saving…' : 'Save shipment'}
    </Button>
  )
}
