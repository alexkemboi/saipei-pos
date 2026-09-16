'use client'

import { useState, useTransition } from 'react'
import { Search, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Textarea } from '@/components/ui/form'
import { TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { formatKes, formatNumber } from '@/lib/utils'
import { createSalesReturn } from './actions'

export interface ReturnableSale {
  id: string
  reference: string
  customerName: string
  total: number
  lines: {
    id: string
    productId: string
    description: string
    quantity: number
    returned: number
    unitPrice: number
  }[]
}

export function SalesReturnForm({
  sales,
  warehouseId,
}: {
  sales: ReturnableSale[]
  warehouseId: string
}) {
  const [search, setSearch] = useState('')
  const [saleId, setSaleId] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [restock, setRestock] = useState(true)
  const [reason, setReason] = useState('')
  const [state, setState] = useState<{ error?: string; success?: string }>({})
  const [isPending, startTransition] = useTransition()

  const matches = search.trim()
    ? sales.filter((s) =>
        `${s.reference} ${s.customerName}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      )
    : sales.slice(0, 8)

  const sale = sales.find((s) => s.id === saleId) ?? null
  const refundTotal = sale
    ? sale.lines.reduce(
        (sum, line) => sum + (quantities[line.id] ?? 0) * line.unitPrice,
        0,
      )
    : 0

  function submit() {
    if (!sale) return
    setState({})
    startTransition(async () => {
      const result = await createSalesReturn({
        saleId: sale.id,
        warehouseId,
        reason,
        restock,
        lines: sale.lines.map((line) => ({
          saleLineId: line.id,
          quantity: quantities[line.id] ?? 0,
        })),
      })
      setState(result)
      if (result.success) {
        setSaleId('')
        setQuantities({})
        setReason('')
        setSearch('')
      }
    })
  }

  return (
    <div className="space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="success" title="Return recorded">
          {state.success}
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Find the original sale"
          description="Returns are always matched to the receipt they came from."
        />
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-saipei-gray-400"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by receipt reference or customer…"
            className="pl-9"
            aria-label="Search sales"
          />
        </div>

        <ul className="mt-3 divide-y divide-saipei-gray-100 rounded-md border border-saipei-gray-200">
          {matches.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-saipei-gray-500">
              No sales match that search.
            </li>
          ) : (
            matches.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSaleId(option.id)
                    setQuantities({})
                  }}
                  className={
                    'flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ' +
                    (option.id === saleId
                      ? 'bg-saipei-green-50 font-semibold text-saipei-green-800'
                      : 'hover:bg-saipei-gray-50')
                  }
                >
                  <span>
                    <span className="tabular font-medium">{option.reference}</span>
                    <span className="ml-2 text-saipei-gray-500">{option.customerName}</span>
                  </span>
                  <span className="tabular">{formatKes(option.total)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </Card>

      {sale ? (
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title={`Items on ${sale.reference}`}
              description="Enter the quantity coming back for each item."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <THead>
                <TR>
                  <TH>Item</TH>
                  <TH align="right">Sold</TH>
                  <TH align="right">Already returned</TH>
                  <TH align="right">Unit price</TH>
                  <TH align="right">Returning</TH>
                  <TH align="right">Refund</TH>
                </TR>
              </THead>
              <TBody>
                {sale.lines.map((line) => {
                  const returnable = line.quantity - line.returned
                  const value = quantities[line.id] ?? 0
                  return (
                    <TR key={line.id}>
                      <TD>
                        <span className="font-medium text-saipei-dark-800">
                          {line.description}
                        </span>
                      </TD>
                      <TD align="right" numeric>
                        {formatNumber(line.quantity)}
                      </TD>
                      <TD align="right" numeric>
                        {formatNumber(line.returned)}
                      </TD>
                      <TD align="right" numeric>
                        {formatKes(line.unitPrice)}
                      </TD>
                      <TD align="right">
                        <input
                          type="number"
                          min={0}
                          max={returnable}
                          value={value || ''}
                          placeholder="0"
                          disabled={returnable <= 0}
                          onChange={(e) =>
                            setQuantities((current) => ({
                              ...current,
                              [line.id]: Math.max(
                                0,
                                Math.min(returnable, Number(e.target.value) || 0),
                              ),
                            }))
                          }
                          aria-label={`Quantity of ${line.description} being returned`}
                          className="tabular h-9 w-20 rounded-md border border-saipei-gray-300 px-2 text-right disabled:bg-saipei-gray-100"
                        />
                      </TD>
                      <TD align="right" numeric>
                        {formatKes(value * line.unitPrice)}
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </table>
          </div>

          <div className="space-y-4 border-t border-saipei-gray-200 px-5 py-5">
            <Field label="Reason for the return" htmlFor="reason">
              <Textarea
                id="reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. wrong size, faulty stitching"
              />
            </Field>

            <label className="flex items-center gap-2.5 text-sm text-saipei-gray-700">
              <input
                type="checkbox"
                checked={restock}
                onChange={(e) => setRestock(e.target.checked)}
                className="h-4 w-4 rounded border-saipei-gray-300 accent-[var(--saipei-green)]"
              />
              Put the goods back into sellable stock
            </label>

            <div className="flex items-center justify-between rounded-md border border-saipei-red-200 bg-saipei-red-50 px-4 py-3">
              <span className="font-semibold text-saipei-red-700">Total to refund</span>
              <span className="tabular text-2xl font-bold text-saipei-red-600">
                {formatKes(refundTotal)}
              </span>
            </div>

            <Button
              size="lg"
              onClick={submit}
              disabled={isPending || refundTotal <= 0}
              icon={<Undo2 className="h-4 w-4" aria-hidden />}
            >
              {isPending ? 'Saving…' : 'Record return'}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
