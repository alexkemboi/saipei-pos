import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-saipei-gray-200 bg-white">
      <table className={cn('w-full border-collapse text-sm', className)}>{children}</table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-saipei-gray-200 bg-saipei-gray-50">
      {children}
    </thead>
  )
}

export function TH({
  children,
  align = 'left',
  className,
}: {
  children?: ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}) {
  return (
    <th
      scope="col"
      className={cn(
        'px-4 py-3 text-xs font-semibold tracking-wide text-saipei-dark-700 uppercase whitespace-nowrap',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-saipei-gray-100">{children}</tbody>
}

export function TR({
  children,
  className,
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'transition-colors hover:bg-saipei-green-50/60',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </tr>
  )
}

export function TD({
  children,
  align = 'left',
  numeric,
  className,
  colSpan,
}: {
  children?: ReactNode
  align?: 'left' | 'right' | 'center'
  numeric?: boolean
  className?: string
  colSpan?: number
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        'px-4 py-3 text-saipei-gray-700',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        numeric && 'tabular font-medium text-saipei-gray-900',
        className,
      )}
    >
      {children}
    </td>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="rounded-full bg-saipei-green-50 p-3 text-saipei-green-600">
        {icon ?? <Inbox className="h-6 w-6" aria-hidden />}
      </div>
      <div>
        <p className="font-semibold text-saipei-dark-800">{title}</p>
        {description ? (
          <p className="mt-1 max-w-sm text-sm text-saipei-gray-500">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

/** Full-width empty row for use inside a populated <Table>. */
export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TR>
      <TD colSpan={colSpan} align="center" className="py-10 text-saipei-gray-500">
        {message}
      </TD>
    </TR>
  )
}
