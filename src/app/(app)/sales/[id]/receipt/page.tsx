import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { PrintButton } from '@/components/ui/print-button'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDateTime, formatKes, formatNumber, humanize } from '@/lib/utils'

export const metadata: Metadata = { title: 'Receipt' }
export const dynamic = 'force-dynamic'

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('sales.view')
  const { id } = await params

  const [sale, company] = await Promise.all([
    db.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        cashier: { select: { fullName: true } },
        lines: true,
        receipts: true,
      },
    }),
    db.setting.findMany({ where: { group: { in: ['company', 'pos', 'mpesa'] } } }),
  ])

  if (!sale) notFound()

  const setting = (key: string, fallback = '') =>
    company.find((s) => s.key === key)?.value ?? fallback

  const receipt = sale.receipts[0]

  return (
    <div className="mx-auto max-w-md">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href={`/sales/${sale.id}`}>
          <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" aria-hidden />}>
            Back to sale
          </Button>
        </Link>
        <PrintButton />
      </div>

      <div className="rounded-[var(--radius-card)] border border-saipei-gray-200 bg-white p-6">
        <div className="flex flex-col items-center text-center">
          <Logo height={52} priority />
          <p className="mt-2 text-xs text-saipei-gray-600">
            {setting('company.address', 'Nairobi, Kenya')}
          </p>
          <p className="text-xs text-saipei-gray-600">
            {setting('company.phone', '+254 787 088567')}
          </p>
          <p className="text-xs text-saipei-gray-600">
            Lipa na M-PESA Buy Goods {setting('mpesa.shortcode', '5606927')}
          </p>
        </div>

        <dl className="mt-4 space-y-0.5 border-y border-dashed border-saipei-gray-300 py-3 text-xs">
          <Line label="Receipt" value={sale.reference} tabular />
          <Line label="Date" value={formatDateTime(sale.saleDate)} tabular />
          <Line label="Customer" value={sale.customer?.name ?? 'Walk-in customer'} />
          <Line label="Served by" value={sale.cashier.fullName} />
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
              <tr key={line.id}>
                <td className="py-1.5 pr-2 text-saipei-gray-700">
                  {line.description}
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
          <Line label="Subtotal" value={formatKes(sale.subtotal)} tabular />
          {Number(sale.discount) > 0 ? (
            <Line label="Discount" value={`−${formatKes(sale.discount)}`} tabular />
          ) : null}
          <Line label="VAT included" value={formatKes(sale.taxAmount)} tabular />
          <div className="flex justify-between pt-1 text-sm">
            <dt className="font-bold text-saipei-dark-800">TOTAL</dt>
            <dd className="tabular font-bold text-saipei-dark-800">
              {formatKes(sale.total)}
            </dd>
          </div>
          {receipt ? (
            <Line label="Paid by" value={humanize(receipt.method)} />
          ) : (
            <Line label="Paid by" value="On account (credit)" />
          )}
          {receipt?.mpesaCode ? (
            <Line label="M-PESA code" value={receipt.mpesaCode} tabular />
          ) : null}
          {Number(sale.changeGiven) > 0 ? (
            <Line label="Change" value={formatKes(sale.changeGiven)} tabular />
          ) : null}
        </dl>

        <p className="mt-4 text-center text-[11px] text-saipei-gray-600">
          {setting('pos.receiptFooter', 'Thank you for shopping with SAIPEI FOODS LIMITED')}
        </p>
        <p className="text-center text-[11px] font-medium text-saipei-dark-700">
          {setting('company.tagline', 'From Kenya with Love')}
        </p>
      </div>
    </div>
  )
}

function Line({
  label,
  value,
  tabular,
}: {
  label: string
  value: string
  tabular?: boolean
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-saipei-gray-500">{label}</dt>
      <dd className={tabular ? 'tabular text-saipei-gray-800' : 'text-saipei-gray-800'}>
        {value}
      </dd>
    </div>
  )
}
