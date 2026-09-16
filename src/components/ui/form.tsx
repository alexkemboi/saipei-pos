import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const CONTROL =
  'w-full rounded-md border bg-white px-3 text-sm text-saipei-gray-900 transition-colors ' +
  'placeholder:text-saipei-gray-400 disabled:bg-saipei-gray-50 disabled:text-saipei-gray-400 ' +
  'border-saipei-gray-300 hover:border-saipei-gray-400'

const CONTROL_ERROR =
  'border-saipei-red-400 bg-saipei-red-50 hover:border-saipei-red-500'

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-saipei-dark-800"
      >
        {label}
        {required ? (
          <span className="ml-0.5 text-saipei-red-500" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p className="text-xs text-saipei-gray-500">{hint}</p>
      ) : null}
      {error ? (
        <p className="flex items-center gap-1 text-xs font-medium text-saipei-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  // React 19 passes ref as an ordinary prop; the POS focuses the search box.
  ref?: Ref<HTMLInputElement>
}

export function Input({ invalid, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, 'h-10', invalid && CONTROL_ERROR, className)}
      {...props}
    />
  )
}

export function Select({
  invalid,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, 'h-10', invalid && CONTROL_ERROR, className)}
      {...props}
    >
      {children}
    </select>
  )
}

export function Textarea({
  invalid,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, 'py-2', invalid && CONTROL_ERROR, className)}
      {...props}
    />
  )
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger'
  title?: string
  children: ReactNode
}) {
  const styles = {
    info: 'bg-saipei-dark-50 border-saipei-dark-200 text-saipei-dark-900',
    success: 'bg-saipei-green-50 border-saipei-green-200 text-saipei-green-900',
    warning: 'bg-saipei-amber-50 border-saipei-amber-200 text-saipei-amber-700',
    danger: 'bg-saipei-red-50 border-saipei-red-200 text-saipei-red-900',
  }[tone]

  return (
    <div className={cn('flex gap-2.5 rounded-md border px-3.5 py-3 text-sm', styles)} role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={title ? 'mt-0.5' : undefined}>{children}</div>
      </div>
    </div>
  )
}
