import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-saipei-gray-200 bg-white shadow-sm',
        padded && 'p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 pb-4', className)}>
      <div>
        <h2 className="text-base font-semibold text-saipei-dark-800">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-saipei-gray-500">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold tracking-wider text-saipei-dark-700 uppercase">
      {children}
    </h3>
  )
}
