import type { Metadata } from 'next'
import { CheckCircle2, MessageSquare, Smartphone, XCircle } from 'lucide-react'
import { Badge, PaymentBadge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert } from '@/components/ui/form'
import { PageHeader, StatCard } from '@/components/ui/page'
import { EmptyRow, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { readMpesaConfig } from '@/lib/mpesa'
import { formatDateTime, formatKes, formatNumber, toNumber } from '@/lib/utils'

export const metadata: Metadata = { title: 'Integrations' }
export const dynamic = 'force-dynamic'

export default async function IntegrationsPage() {
  await requirePermission('admin.settings')

  const config = readMpesaConfig()
  const shortcode = process.env.MPESA_SHORTCODE ?? '5606927'

  const [transactions, stats] = await Promise.all([
    db.mpesaTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        phoneNumber: true,
        amount: true,
        mpesaReceipt: true,
        accountReference: true,
        status: true,
        resultDesc: true,
        createdAt: true,
      },
    }),
    db.mpesaTransaction.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ])

  const countOf = (status: string) =>
    stats.find((row) => row.status === status)?._count._all ?? 0
  const completedValue = toNumber(
    stats.find((row) => row.status === 'COMPLETED')?._sum.amount,
  )

  return (
    <>
      <PageHeader
        breadcrumb="Administration"
        title="Integrations"
        description="M-PESA and messaging services connected to SAIPEI POS."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="M-PESA status"
          value={config ? 'Connected' : 'Not configured'}
          sublabel={config ? `${config.env} environment` : 'credentials missing'}
          tone={config ? 'green' : 'amber'}
          icon={<Smartphone className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Buy Goods till"
          value={shortcode}
          sublabel="Lipa na M-PESA"
          tone="dark"
        />
        <StatCard
          label="Confirmed payments"
          value={formatNumber(countOf('COMPLETED'))}
          sublabel={formatKes(completedValue)}
          tone="green"
        />
        <StatCard
          label="Failed or pending"
          value={formatNumber(countOf('FAILED') + countOf('PENDING'))}
          sublabel="prompts not confirmed"
          tone={countOf('FAILED') > 0 ? 'red' : 'dark'}
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Lipa na M-PESA"
            description="Sends a payment prompt to the customer's phone from the till."
          />

          {config ? (
            <Alert tone="success" title="Connected">
              STK push is live against the {config.env} environment on till{' '}
              {config.shortcode}. Callbacks are received at{' '}
              <span className="tabular">{config.callbackUrl}</span>.
            </Alert>
          ) : (
            <Alert tone="warning" title="Credentials not set">
              Cashiers can still take M-PESA by typing the confirmation code from the
              customer&apos;s SMS. To send the prompt automatically, set the Daraja
              credentials in the environment and restart the application.
            </Alert>
          )}

          <dl className="mt-4 space-y-2.5 text-sm">
            <Row
              label="Environment"
              value={config?.env ?? 'not set'}
              ok={Boolean(config)}
            />
            <Row label="Buy Goods till" value={shortcode} ok />
            <Row
              label="Consumer key"
              value={process.env.MPESA_CONSUMER_KEY ? 'Set' : 'Missing'}
              ok={Boolean(process.env.MPESA_CONSUMER_KEY)}
            />
            <Row
              label="Consumer secret"
              value={process.env.MPESA_CONSUMER_SECRET ? 'Set' : 'Missing'}
              ok={Boolean(process.env.MPESA_CONSUMER_SECRET)}
            />
            <Row
              label="Passkey"
              value={process.env.MPESA_PASSKEY ? 'Set' : 'Missing'}
              ok={Boolean(process.env.MPESA_PASSKEY)}
            />
            <Row
              label="Callback URL"
              value={process.env.MPESA_CALLBACK_URL ?? 'Missing'}
              ok={Boolean(process.env.MPESA_CALLBACK_URL)}
            />
          </dl>

          <p className="mt-4 text-xs text-saipei-gray-500">
            Credentials are read from the environment and never stored in the database,
            so they cannot be read back out through the application.
          </p>
        </Card>

        <Card>
          <CardHeader
            title="SMS and email"
            description="Sending receipts and statements to customers."
          />
          <Alert tone="info" title="Not yet connected">
            No SMS or email provider is configured. Receipts print from the till and
            statements are printed from the customer screen.
          </Alert>
          <div className="mt-4 flex items-center gap-2 text-sm text-saipei-gray-500">
            <MessageSquare className="h-4 w-4" aria-hidden />
            Ready for an Africa&apos;s Talking or SMTP provider when required.
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Recent M-PESA prompts"
            description="STK push requests sent from the till and what came back."
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Phone</TH>
                <TH>Reference</TH>
                <TH align="right">Amount</TH>
                <TH>M-PESA code</TH>
                <TH>Result</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {transactions.length === 0 ? (
                <EmptyRow colSpan={7} message="No M-PESA prompts have been sent yet." />
              ) : (
                transactions.map((transaction) => (
                  <TR key={transaction.id}>
                    <TD>{formatDateTime(transaction.createdAt)}</TD>
                    <TD>
                      <span className="tabular">{transaction.phoneNumber}</span>
                    </TD>
                    <TD>
                      <span className="tabular text-saipei-gray-600">
                        {transaction.accountReference ?? '—'}
                      </span>
                    </TD>
                    <TD align="right" numeric>
                      {formatKes(transaction.amount)}
                    </TD>
                    <TD>
                      <span className="tabular">{transaction.mpesaReceipt ?? '—'}</span>
                    </TD>
                    <TD>
                      <span className="text-saipei-gray-600">
                        {transaction.resultDesc ?? '—'}
                      </span>
                    </TD>
                    <TD>
                      <PaymentBadge status={transaction.status} />
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </table>
        </div>
      </Card>
    </>
  )
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-saipei-gray-500">{label}</dt>
      <dd>
        <Badge
          tone={ok ? 'success' : 'warning'}
          icon={
            ok ? (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <XCircle className="h-3.5 w-3.5" aria-hidden />
            )
          }
        >
          {value}
        </Badge>
      </dd>
    </div>
  )
}
