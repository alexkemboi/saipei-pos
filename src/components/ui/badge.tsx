import type { ReactNode } from 'react'
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Info,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { humanize } from '@/lib/utils'

export type Tone = 'success' | 'danger' | 'warning' | 'neutral' | 'info'

const TONES: Record<Tone, string> = {
  success: 'bg-saipei-green-50 text-saipei-green-800 border-saipei-green-200',
  danger: 'bg-saipei-red-50 text-saipei-red-800 border-saipei-red-200',
  warning: 'bg-saipei-amber-50 text-saipei-amber-700 border-saipei-amber-200',
  neutral: 'bg-saipei-gray-100 text-saipei-gray-700 border-saipei-gray-200',
  info: 'bg-saipei-dark-50 text-saipei-dark-800 border-saipei-dark-200',
}

const TONE_ICONS: Record<Tone, ReactNode> = {
  success: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
  danger: <XCircle className="h-3.5 w-3.5" aria-hidden />,
  warning: <AlertTriangle className="h-3.5 w-3.5" aria-hidden />,
  neutral: <Ban className="h-3.5 w-3.5" aria-hidden />,
  info: <Info className="h-3.5 w-3.5" aria-hidden />,
}

/**
 * Status is never colour alone - every badge carries an icon and a label so it
 * still reads for colour-blind users and in greyscale print.
 */
export function Badge({
  tone = 'neutral',
  children,
  icon,
  className,
}: {
  tone?: Tone
  children: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {icon ?? TONE_ICONS[tone]}
      {children}
    </span>
  )
}

/** Maps every status value in the schema onto a tone, in one place. */
const STATUS_TONES: Record<string, Tone> = {
  // Generic approval
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  // Sales
  COMPLETED: 'success',
  CREDIT: 'warning',
  PARTIALLY_PAID: 'warning',
  CANCELLED: 'neutral',
  VOIDED: 'danger',
  DRAFT: 'neutral',
  // Payments
  FAILED: 'danger',
  REVERSED: 'danger',
  // Invoices
  UNPAID: 'danger',
  PAID: 'success',
  // Purchase orders
  PENDING_APPROVAL: 'warning',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',
  // Shipments / imports
  LOADED: 'info',
  DEPARTED: 'info',
  IN_TRANSIT: 'info',
  ARRIVED: 'info',
  CLEARING: 'warning',
  CLEARED: 'success',
  RELEASED: 'success',
  DELIVERED: 'success',
  ORDER_PLACED: 'neutral',
  SUPPLIER_INVOICED: 'info',
  DEPOSIT_PAID: 'info',
  DOCUMENTATION: 'warning',
  CLOSED: 'neutral',
  // Cash / stock take
  OPEN: 'success',
  COUNTING: 'warning',
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge tone="neutral">—</Badge>
  return <Badge tone={STATUS_TONES[status] ?? 'neutral'}>{humanize(status)}</Badge>
}

/** Stock availability communicated with an icon + words, not colour alone. */
export function StockBadge({
  quantity,
  reorderLevel,
}: {
  quantity: number
  reorderLevel: number
}) {
  if (quantity <= 0) {
    return (
      <Badge tone="danger" icon={<XCircle className="h-3.5 w-3.5" aria-hidden />}>
        Out of stock
      </Badge>
    )
  }
  if (quantity <= reorderLevel) {
    return (
      <Badge tone="warning" icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden />}>
        Low stock
      </Badge>
    )
  }
  return (
    <Badge tone="success" icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}>
      In stock
    </Badge>
  )
}

export function PaymentBadge({ status }: { status: string }) {
  if (status === 'COMPLETED') {
    return (
      <Badge tone="success" icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}>
        Paid
      </Badge>
    )
  }
  if (status === 'PENDING') {
    return (
      <Badge tone="warning" icon={<Clock className="h-3.5 w-3.5" aria-hidden />}>
        Pending
      </Badge>
    )
  }
  if (status === 'FAILED') {
    return (
      <Badge tone="danger" icon={<XCircle className="h-3.5 w-3.5" aria-hidden />}>
        Failed
      </Badge>
    )
  }
  return <StatusBadge status={status} />
}
