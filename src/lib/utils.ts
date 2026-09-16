export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

const KES = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  minimumFractionDigits: 2,
})

/** Money is always shown with its currency - never a bare number. */
export function formatKes(value: unknown): string {
  return KES.format(toNumber(value))
}

export function formatNumber(value: unknown, decimals = 0): string {
  return new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(toNumber(value))
}

/** Prisma returns Decimal columns as objects; normalise before arithmetic. */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value) || 0
  if (typeof value === 'object' && 'toString' in value) {
    return Number((value as { toString(): string }).toString()) || 0
  }
  return 0
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** Human label for the SCREAMING_SNAKE values stored in status columns. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—'
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Document references: SAI-INV-2026-0001 style.
 * Sequence comes from the caller (a count query) so numbering stays readable.
 */
export function buildReference(prefix: string, sequence: number, date = new Date()): string {
  return `${prefix}-${date.getFullYear()}-${String(sequence).padStart(4, '0')}`
}
