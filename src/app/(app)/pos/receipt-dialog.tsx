'use client'

import { CheckCircle2, Printer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { formatDateTime, formatKes, formatNumber, humanize } from '@/lib/utils'

export interface CompletedSale {
  reference: string
  lines: { name: string; quantity: number; unitPrice: number; lineTotal: number }[]
  total: number
  discount: number
  method: string
  amountTendered: number
  change: number
  customerName: string
  cashierName: string
  soldAt: Date
}

export function ReceiptDialog({
  sale,
  onClose,
}: {
  sale: CompletedSale
  onClose: () => void
}) {
  const isCredit = sale.method === 'CREDIT'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-saipei-dark-950/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-title"
    >
      <div className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-[var(--radius-card)] bg-white shadow-xl">
        {/* Success is green + icon + words, never colour alone */}
        <div className="no-print flex items-start justify-between bg-saipei-green-500 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-6 w-6 text-white" aria-hidden />
            <div>
              <h2 id="receipt-title" className="font-semibold text-white">
                {isCredit ? 'Sale recorded on account' : 'Payment received'}
              </h2>
              <p className="tabular text-sm text-white/90">{sale.reference}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt"
            className="rounded-md p-1.5 text-white hover:bg-saipei-green-600"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {!isCredit && sale.change > 0 ? (
          <div className="no-print flex items-baseline justify-between border-b border-saipei-gray-200 bg-saipei-green-50 px-5 py-3">
            <span className="font-semibold text-saipei-green-800">Change due</span>
            <span className="tabular text-2xl font-bold text-saipei-green-700">
              {formatKes(sale.change)}
            </span>
          </div>
        ) : null}

        {/* ---------- Printable receipt ---------- */}
        <div className="flex-1 overflow-y-auto px-5 py-5" id="receipt-body">
          <div className="flex flex-col items-center text-center">
            <Logo height={46} />
            <p className="mt-2 text-xs text-saipei-gray-500">
              Nairobi, Kenya · +254 787 088567
            </p>
            <p className="text-xs text-saipei-gray-500">
              Lipa na M-PESA Buy Goods 5606927
            </p>
          </div>

          <dl className="mt-4 space-y-0.5 border-y border-dashed border-saipei-gray-300 py-3 text-xs">
            <div className="flex justify-between">
              <dt className="text-saipei-gray-500">Receipt</dt>
              <dd className="tabular font-semibold text-saipei-dark-800">
                {sale.reference}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-saipei-gray-500">Date</dt>
              <dd className="tabular text-saipei-gray-700">
                {formatDateTime(sale.soldAt)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-saipei-gray-500">Customer</dt>
              <dd className="text-saipei-gray-700">{sale.customerName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-saipei-gray-500">Served by</dt>
              <dd className="text-saipei-gray-700">{sale.cashierName}</dd>
            </div>
          </dl>

          <table className="mt-3 w-full text-xs">
            <thead>
              <tr className="border-b border-saipei-gray-200">
                <th scope="col" className="py-1.5 text-left font-semibold text-saipei-dark-700">
                  Item
                </th>
                <th scope="col" className="py-1.5 text-right font-semibold text-saipei-dark-700">
                  Qty
                </th>
                <th scope="col" className="py-1.5 text-right font-semibold text-saipei-dark-700">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-saipei-gray-100">
              {sale.lines.map((line) => (
                <tr key={line.name}>
                  <td className="py-1.5 pr-2 text-saipei-gray-700">
                    {line.name}
                    <span className="tabular block text-[11px] text-saipei-gray-400">
                      @ {formatKes(line.unitPrice)}
                    </span>
                  </td>
                  <td className="tabular py-1.5 text-right text-saipei-gray-700">
                    {formatNumber(line.quantity)}
                  </td>
                  <td className="tabular py-1.5 text-right font-medium text-saipei-gray-900">
                    {formatKes(line.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="mt-3 space-y-1 border-t border-dashed border-saipei-gray-300 pt-3 text-xs">
            {sale.discount > 0 ? (
              <div className="flex justify-between">
                <dt className="text-saipei-gray-500">Discount</dt>
                <dd className="tabular text-saipei-red-600">
                  −{formatKes(sale.discount)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between text-sm">
              <dt className="font-bold text-saipei-dark-800">TOTAL</dt>
              <dd className="tabular font-bold text-saipei-dark-800">
                {formatKes(sale.total)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-saipei-gray-500">Paid by</dt>
              <dd className="text-saipei-gray-700">{humanize(sale.method)}</dd>
            </div>
            {!isCredit && sale.method === 'CASH' ? (
              <>
                <div className="flex justify-between">
                  <dt className="text-saipei-gray-500">Cash received</dt>
                  <dd className="tabular text-saipei-gray-700">
                    {formatKes(sale.amountTendered)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-saipei-gray-500">Change</dt>
                  <dd className="tabular text-saipei-gray-700">
                    {formatKes(sale.change)}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>

          <p className="mt-4 text-center text-[11px] text-saipei-gray-500">
            Thank you for shopping with SAIPEI FOODS LIMITED
          </p>
          <p className="text-center text-[11px] font-medium text-saipei-dark-700">
            From Kenya with Love
          </p>
        </div>

        <div className="no-print flex gap-3 border-t border-saipei-gray-200 px-5 py-4">
          <Button
            variant="neutral"
            size="lg"
            className="flex-1"
            onClick={() => window.print()}
            icon={<Printer className="h-4 w-4" aria-hidden />}
          >
            Print
          </Button>
          <Button size="lg" className="flex-1" onClick={onClose} autoFocus>
            New sale
          </Button>
        </div>
      </div>
    </div>
  )
}
