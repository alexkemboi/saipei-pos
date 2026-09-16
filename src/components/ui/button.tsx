import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type ButtonVariant =
  | 'primary' // SAIPEI green - the affirmative action
  | 'secondary' // dark green - structural / alternate action
  | 'danger' // SAIPEI red - destructive
  | 'neutral' // cancel, dismiss
  | 'outline'
  | 'ghost'

type ButtonSize = 'sm' | 'md' | 'lg' | 'pos'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-saipei-green-500 text-white hover:bg-saipei-green-600 active:bg-saipei-green-700 shadow-sm',
  secondary:
    'bg-saipei-dark-700 text-white hover:bg-saipei-dark-800 active:bg-saipei-dark-900 shadow-sm',
  danger:
    'bg-saipei-red-500 text-white hover:bg-saipei-red-600 active:bg-saipei-red-700 shadow-sm',
  neutral:
    'bg-white text-saipei-gray-700 border border-saipei-gray-300 hover:bg-saipei-gray-50 active:bg-saipei-gray-100',
  outline:
    'bg-transparent text-saipei-dark-700 border border-saipei-dark-700 hover:bg-saipei-dark-50',
  ghost: 'bg-transparent text-saipei-gray-600 hover:bg-saipei-gray-100',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  pos: 'h-14 px-6 text-lg gap-2.5 font-semibold', // large hit target for tills
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
