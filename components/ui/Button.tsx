'use client'

import { forwardRef } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost' | 'link'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary hover:bg-primary-hover text-white font-medium shadow-sm',
  secondary: 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700',
  danger: 'bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm',
  warning: 'bg-orange-600 hover:bg-orange-700 text-white font-medium shadow-sm',
  ghost: 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/60',
  link: 'text-primary dark:text-primary-light hover:underline font-medium',
}

// md = výška 40 px (na mobilu 44 px), sm vizuálně menší s rozšířenou klikací plochou
const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 hit-area',
  md: 'h-10 max-md:min-h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
}

export function buttonClasses({ variant = 'primary', size = 'md', block = false, className }: {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  className?: string
} = {}) {
  return cn(
    'inline-flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none',
    variant === 'link' ? 'text-sm' : SIZE[size],
    VARIANT[variant],
    block && 'w-full',
    className,
  )
}

function Spinner() {
  return <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden />
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  /** Zobrazí spinner a tlačítko zablokuje */
  loading?: boolean
}

/** Sdílené tlačítko — viz CLAUDE.md „UI primitivy". */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, loading, className, children, disabled, type = 'button', ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-compact={size === 'sm' || variant === 'link' ? '' : undefined}
      className={buttonClasses({ variant, size, block, className })}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
})

export interface ButtonLinkProps extends Omit<React.ComponentProps<typeof Link>, 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  className?: string
}

/** Odkaz vypadající jako tlačítko (next/link). */
export function ButtonLink({ variant, size, block, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, block, className })} {...rest} />
}
