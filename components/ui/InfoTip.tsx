'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

/**
 * Ikona „i" s vysvětlivkou. Na rozdíl od `title` funguje i na dotyku
 * a z klávesnice: klik/Enter otevře, klik mimo nebo Esc zavře.
 */
export function InfoTip({ text, label = 'Vysvětlivka', className }: { text: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <span ref={ref} className={cn('relative inline-flex flex-shrink-0', className)}>
      <button
        type="button"
        data-compact
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        title={text}
        onClick={() => setOpen(o => !o)}
        className="hit-area text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-full mt-2 z-30 w-72 max-w-[80vw] rounded-lg bg-gray-900 dark:bg-slate-700 text-white text-xs leading-relaxed px-3 py-2 shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  )
}
