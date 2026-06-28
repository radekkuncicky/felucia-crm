'use client'

import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { cs } from 'date-fns/locale'

function parseIso(val: string): Date | undefined {
  if (!val) return undefined
  const d = new Date(val + 'T12:00:00')
  return isNaN(d.getTime()) ? undefined : d
}

function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function formatCz(d: Date | undefined): string {
  if (!d) return ''
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' })
}

interface Props {
  value: string          // YYYY-MM-DD or ''
  onChange: (val: string) => void
  required?: boolean
  className?: string
  placeholder?: string
}

export default function DatePickerInput({ value, onChange, required, className, placeholder = 'Vyberte datum' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = parseIso(value)

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function handleSelect(day: Date | undefined) {
    if (day) {
      onChange(toIso(day))
      setOpen(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full text-left flex items-center justify-between gap-2 ${className}`}
      >
        <span className={selected ? '' : 'text-gray-400 dark:text-slate-500'}>
          {selected ? formatCz(selected) : placeholder}
        </span>
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
      {required && (
        <input tabIndex={-1} required value={value} onChange={() => {}} className="sr-only" aria-hidden />
      )}

      {open && (
        <div className="absolute z-50 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl p-3 left-0">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected ?? new Date()}
            locale={cs}
            classNames={{
              root: 'text-sm',
              months: '',
              month: '',
              month_caption: 'flex justify-between items-center mb-2 px-1',
              caption_label: 'text-sm font-semibold text-gray-900 dark:text-white capitalize',
              nav: 'flex items-center gap-1',
              button_previous: 'p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400',
              button_next:     'p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400',
              weeks: '',
              week: 'flex',
              weekdays: 'flex',
              weekday: 'w-8 h-7 flex items-center justify-center text-xs font-medium text-gray-400 dark:text-slate-500',
              day: 'w-8 h-8 flex items-center justify-center',
              day_button: 'w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors focus:outline-none',
              selected: '[&>button]:bg-primary [&>button]:text-white [&>button]:hover:bg-primary',
              today: '[&>button]:font-bold [&>button]:text-primary dark:[&>button]:text-primary-light',
              outside: '[&>button]:text-gray-300 dark:[&>button]:text-slate-600',
              disabled: '[&>button]:opacity-30 [&>button]:cursor-not-allowed',
            }}
          />
        </div>
      )}
    </div>
  )
}
