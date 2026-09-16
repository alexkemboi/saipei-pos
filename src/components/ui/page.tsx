import type { ReactNode } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  action,
  breadcrumb,
}: {
  title: string
  description?: string
  action?: ReactNode
  breadcrumb?: string
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {breadcrumb ? (
          <p className="mb-1 text-xs font-semibold tracking-wider text-saipei-green-700 uppercase">
            {breadcrumb}
          </p>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight text-saipei-dark-800">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-saipei-gray-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  )
}

type StatTone = 'green' | 'red' | 'dark' | 'amber' | 'neutral'

const STAT_ACCENTS: Record<StatTone, string> = {
  green: 'bg-saipei-green-50 text-saipei-green-700',
  red: 'bg-saipei-red-50 text-saipei-red-600',
  dark: 'bg-saipei-dark-50 text-saipei-dark-700',
  amber: 'bg-saipei-amber-50 text-saipei-amber-700',
  neutral: 'bg-saipei-gray-100 text-saipei-gray-600',
}

export function StatCard({
  label,
  value,
  sublabel,
  icon,
  tone = 'dark',
  trend,
}: {
  label: string
  value: string
  sublabel?: string
  icon?: ReactNode
  tone?: StatTone
  trend?: { direction: 'up' | 'down'; label: string }
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-saipei-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold tracking-wider text-saipei-gray-500 uppercase">
          {label}
        </p>
        {icon ? (
          <span className={cn('rounded-md p-2', STAT_ACCENTS[tone])}>{icon}</span>
        ) : null}
      </div>
      <p className="tabular mt-3 text-2xl font-bold text-saipei-dark-800">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {trend ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              trend.direction === 'up'
                ? 'text-saipei-green-700'
                : 'text-saipei-red-600',
            )}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" aria-hidden />
            )}
            {trend.label}
          </span>
        ) : null}
        {sublabel ? (
          <span className="text-xs text-saipei-gray-500">{sublabel}</span>
        ) : null}
      </div>
    </div>
  )
}
