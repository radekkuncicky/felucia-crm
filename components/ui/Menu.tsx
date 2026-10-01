'use client'

import { IconDots } from './Icons'
import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

export interface MenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  /** Oddělovací čára nad položkou */
  separator?: boolean
}

/**
 * Rozbalovací menu akcí („⋯"). Esc a klik mimo zavírají, šipky přepínají položky,
 * focus se vrací na spouštěcí tlačítko.
 */
export function Menu({ label = 'Další akce', items, trigger, align = 'right', className }: {
  label?: string
  items: MenuItem[]
  /** Obsah spouštěcího tlačítka (výchozí „⋯") */
  trigger?: React.ReactNode
  align?: 'left' | 'right'
  className?: string
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>('[role=menuitem]:not([disabled])')?.focus()
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function close(refocus = true) {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const els = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role=menuitem]:not([disabled])') ?? [])
    const i = els.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % els.length : (i - 1 + els.length) % els.length
    els[next]?.focus()
  }

  return (
    <div ref={rootRef} className={cn('relative inline-block', className)} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={trigger ? undefined : label}
        title={label}
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 text-sm"
      >
        {trigger ?? <IconDots className="w-4 h-4" aria-hidden />}
      </button>
      {open && (
        <div
          ref={listRef}
          id={id}
          role="menu"
          aria-label={label}
          className={cn(
            'absolute top-full mt-1 z-40 min-w-[220px] py-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map(item => (
            <div key={item.label}>
              {item.separator && <div className="my-1 border-t border-gray-100 dark:border-slate-700" role="separator" />}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => { close(false); item.onSelect() }}
                className={cn(
                  'w-full text-left px-4 py-2 text-sm transition-colors disabled:opacity-50 focus:outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-slate-700',
                  item.danger
                    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                    : 'text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700',
                )}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
