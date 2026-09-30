'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Povinný popis pro čtečky i tooltip (tlačítko nemá text) */
  label: string
  tone?: 'default' | 'danger'
}

/** Tlačítko jen s ikonou — 36 px na desktopu, 44 px na mobilu. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tone = 'default', className, children, type = 'button', title, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={title ?? label}
      className={cn(
        'inline-flex items-center justify-center w-9 h-9 max-md:w-11 max-md:h-11 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0 [&>svg]:w-5 [&>svg]:h-5',
        tone === 'danger'
          ? 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
          : 'text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
})
