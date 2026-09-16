'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Save } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Textarea } from '@/components/ui/form'
import { Logo } from '@/components/ui/logo'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { updateSettings, type FormState } from '../actions'

const EMPTY: FormState = {}

export function SettingsForm({
  values,
  branches,
  warehouses,
}: {
  values: Record<string, string>
  branches: { id: string; name: string; code: string }[]
  warehouses: { id: string; name: string; code: string; isDefault: boolean }[]
}) {
  const [state, formAction] = useActionState(updateSettings, EMPTY)

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="success" title="Saved">
          {state.success}
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Company"
          description="Printed on receipts, invoices and reports."
        />
        <div className="mb-5 flex items-center gap-4 rounded-md border border-saipei-gray-200 bg-saipei-gray-50 px-4 py-3">
          <Logo height={40} />
          <p className="text-xs text-saipei-gray-500">
            The SAIPEI FOODS LIMITED mark is supplied with the system and is used
            throughout. It is never stretched or recoloured.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company name" htmlFor="company.name" required>
            <Input
              id="company.name"
              name="company.name"
              defaultValue={values['company.name'] ?? 'SAIPEI FOODS LIMITED'}
            />
          </Field>

          <Field label="Tagline" htmlFor="company.tagline">
            <Input
              id="company.tagline"
              name="company.tagline"
              defaultValue={values['company.tagline'] ?? 'From Kenya with Love'}
            />
          </Field>

          <Field label="Phone" htmlFor="company.phone">
            <Input
              id="company.phone"
              name="company.phone"
              defaultValue={values['company.phone'] ?? ''}
              className="tabular"
            />
          </Field>

          <Field label="KRA PIN" htmlFor="company.taxPin">
            <Input
              id="company.taxPin"
              name="company.taxPin"
              defaultValue={values['company.taxPin'] ?? ''}
              className="tabular"
            />
          </Field>

          <Field label="Address" htmlFor="company.address" className="sm:col-span-2">
            <Textarea
              id="company.address"
              name="company.address"
              rows={2}
              defaultValue={values['company.address'] ?? ''}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Tax and pricing" description="Applied to new products." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Default VAT rate (%)"
            htmlFor="tax.vatRate"
            hint="Kenyan standard rate is 16%."
          >
            <Input
              id="tax.vatRate"
              name="tax.vatRate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={values['tax.vatRate'] ?? '16'}
              className="tabular"
            />
          </Field>

          <Field
            label="Default currency"
            htmlFor="tax.currency"
            hint="All reporting is in Kenyan shillings."
          >
            <Input
              id="tax.currency"
              name="tax.currency"
              defaultValue={values['tax.currency'] ?? 'KES'}
              className="tabular"
              readOnly
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Point of sale" description="How the till behaves and prints." />
        <div className="grid grid-cols-1 gap-4">
          <Field
            label="Receipt footer"
            htmlFor="pos.receiptFooter"
            hint="The thank-you line at the bottom of every receipt."
          >
            <Input
              id="pos.receiptFooter"
              name="pos.receiptFooter"
              defaultValue={
                values['pos.receiptFooter'] ??
                'Thank you for shopping with SAIPEI FOODS LIMITED'
              }
            />
          </Field>
        </div>
      </Card>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Branches and warehouses"
            description="Where stock is held and sold. Managed in the database."
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <THead>
              <TR>
                <TH>Code</TH>
                <TH>Name</TH>
                <TH>Type</TH>
              </TR>
            </THead>
            <TBody>
              {branches.length === 0 && warehouses.length === 0 ? (
                <EmptyRow colSpan={3} message="No branches or warehouses configured." />
              ) : (
                <>
                  {branches.map((branch) => (
                    <TR key={branch.id}>
                      <TD>
                        <span className="tabular text-saipei-gray-600">{branch.code}</span>
                      </TD>
                      <TD>
                        <span className="font-medium text-saipei-dark-800">
                          {branch.name}
                        </span>
                      </TD>
                      <TD>
                        <Badge tone="info">Branch</Badge>
                      </TD>
                    </TR>
                  ))}
                  {warehouses.map((warehouse) => (
                    <TR key={warehouse.id}>
                      <TD>
                        <span className="tabular text-saipei-gray-600">
                          {warehouse.code}
                        </span>
                      </TD>
                      <TD>
                        <span className="font-medium text-saipei-dark-800">
                          {warehouse.name}
                        </span>
                      </TD>
                      <TD>
                        {warehouse.isDefault ? (
                          <Badge tone="success">Default warehouse</Badge>
                        ) : (
                          <Badge tone="neutral">Warehouse</Badge>
                        )}
                      </TD>
                    </TR>
                  ))}
                </>
              )}
            </TBody>
          </table>
        </div>
      </Card>

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      icon={<Save className="h-4 w-4" aria-hidden />}
    >
      {pending ? 'Saving…' : 'Save settings'}
    </Button>
  )
}
