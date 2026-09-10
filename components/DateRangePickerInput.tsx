'use client'

import { useState, useRef, useEffect } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { cs } from 'date-fns/locale'
import { countWorkingDays, dateToIso, formatIsoCz, isoToDate } from '@/lib/workingDays'

interface Props {
  from: string           // YYYY-MM-DD nebo ''
  to: string             // YYYY-MM-DD nebo ''
  onChange: (range: { from: string; to: string }) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  /** Zobrazit pod kalendářem počet pracovních dnů vybraného rozsahu */
  showWorkingDays?: boolean
}

/**
 * Výběr rozsahu dnů (od–do) v kalendáři. První klik = začátek, druhý = konec;
 * klik na jeden den dvakrát = jednodenní rozsah.
 */
export default function DateRangePickerInput({
  from, to, onChange, className, placeholder = 'Vyberte dny', disabled, showWorkingDays = true,
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected: DateRange | undefined = from
    ? { from: isoToDate(from) ?? undefined, to: isoToDate(to) ?? undefined }
    : undefined

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function handleSelect(range: DateRange | undefined, clicked: Date) {
    // Po hotovém rozsahu začíná další klik nový výběr od kliknutého dne
    if (from && to && from !== to) {
      onChange({ from: dateToIso(clicked), to: '' })
      return
    }
    if (!range?.from) {
      // react-day-picker při kliku na již vybraný začátek výběr zruší → bereme to jako jednodenní rozsah
      onChange({ from: dateToIso(clicked), to: dateToIso(clicked) })
      setOpen(false)
      return
    }
    const f = dateToIso(range.from)
    const t = range.to ? dateToIso(range.to) : ''
    onChange({ from: f, to: t })
    if (t) setOpen(false)
  }

  const label = from
    ? (to && to !== from ? `${formatIsoCz(from)} – ${formatIsoCz(to)}` : formatIsoCz(from))
    : ''
  const workingDays = from && to ? countWorkingDays(from, to) : 0

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`w-full text-left flex items-center justify-between gap-2 disabled:opacity-50 ${className ?? ''}`}
      >
        <span className={label ? '' : 'text-gray-400 dark:text-slate-500'}>
          {label || placeholder}
        </span>
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl p-3 left-0">
          <DayPicker
            mode="range"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected?.from ?? new Date()}
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
              selected: '',
              range_start: 'bg-primary/15 rounded-l-full [&>button]:bg-primary [&>button]:text-white [&>button]:hover:bg-primary',
              range_end: 'bg-primary/15 rounded-r-full [&>button]:bg-primary [&>button]:text-white [&>button]:hover:bg-primary',
              range_middle: 'bg-primary/15 [&>button]:rounded-none [&>button]:text-gray-900 dark:[&>button]:text-white',
              today: '[&>button]:font-bold [&>button]:text-primary dark:[&>button]:text-primary-light',
              outside: '[&>button]:text-gray-300 dark:[&>button]:text-slate-600',
              disabled: '[&>button]:opacity-30 [&>button]:cursor-not-allowed',
            }}
          />
          <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
            <span className="text-xs text-gray-500 dark:text-slate-400">
              {!from ? 'Klikněte na první den'
                : !to ? 'Klikněte na poslední den'
                : showWorkingDays ? `${workingDays} pracovních dnů` : ''}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Hotovo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
