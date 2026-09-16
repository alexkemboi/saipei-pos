'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { FilePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Select, Textarea } from '@/components/ui/form'
import { humanize } from '@/lib/utils'
import { addImportDocument, type FormState } from '../actions'

const EMPTY: FormState = {}

const DOC_TYPES = [
  'IDF',
  'CUSTOMS_DECLARATION',
  'ACA_PERMIT',
  'UCR',
  'BILL_OF_LADING',
  'PACKING_LIST',
  'COMMERCIAL_INVOICE',
  'PVOC_KEBS',
  'FUMIGATION_CERT',
  'HEALTH_CERT',
  'RELEASE_ORDER',
  'OTHER',
]

export function DocumentForm({
  orders,
  shipments,
}: {
  orders: { id: string; label: string }[]
  shipments: { id: string; importOrderId: string; label: string }[]
}) {
  const [state, formAction] = useActionState(addImportDocument, EMPTY)
  const errors = state.fieldErrors ?? {}
  const [importOrderId, setImportOrderId] = useState('')

  // Only offer shipments that belong to the chosen order.
  const relevant = shipments.filter((s) => s.importOrderId === importOrderId)

  return (
    <form action={formAction}>
      <Card>
        <CardHeader
          title="Capture a document"
          description="Record the reference and dates; attach a scan by URL if you keep one."
        />

        {state.error ? (
          <div className="mb-4">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}
        {state.success ? (
          <div className="mb-4">
            <Alert tone="success" title="Document captured">
              {state.success}
            </Alert>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Import order"
            htmlFor="importOrderId"
            required
            error={errors.importOrderId}
          >
            <Select
              id="importOrderId"
              name="importOrderId"
              value={importOrderId}
              onChange={(e) => setImportOrderId(e.target.value)}
              required
            >
              <option value="">Choose an import order…</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Shipment" htmlFor="shipmentId" hint="Optional — for order-level documents.">
            <Select id="shipmentId" name="shipmentId" disabled={!importOrderId}>
              <option value="">Applies to the whole order</option>
              {relevant.map((shipment) => (
                <option key={shipment.id} value={shipment.id}>
                  {shipment.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Document type" htmlFor="type" required>
            <Select id="type" name="type" defaultValue="IDF" required>
              {DOC_TYPES.map((type) => (
                <option key={type} value={type}>
                  {humanize(type)}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Document reference"
            htmlFor="reference"
            hint="IDF number, UCR, permit number…"
          >
            <Input id="reference" name="reference" className="tabular" />
          </Field>

          <Field label="Issue date" htmlFor="issueDate">
            <Input id="issueDate" name="issueDate" type="date" />
          </Field>

          <Field label="Expiry date" htmlFor="expiryDate">
            <Input id="expiryDate" name="expiryDate" type="date" />
          </Field>

          <Field
            label="Scan or file link"
            htmlFor="fileUrl"
            className="sm:col-span-2"
            hint="A link to where the scanned document is stored."
          >
            <Input id="fileUrl" name="fileUrl" type="url" placeholder="https://…" />
          </Field>

          <Field label="Notes" htmlFor="notes" className="lg:col-span-3">
            <Textarea id="notes" name="notes" rows={2} />
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
    <Button type="submit" disabled={pending} icon={<FilePlus className="h-4 w-4" aria-hidden />}>
      {pending ? 'Saving…' : 'Capture document'}
    </Button>
  )
}
