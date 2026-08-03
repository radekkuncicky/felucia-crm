'use client'

import { useState, useRef, useEffect, useMemo, KeyboardEvent } from 'react'
import { IconChevronDown, IconCheck } from './Icons'

export interface FilterDropdownOption {
  value: string
  label: string
}

interface FilterDropdownProps {
  value: string
  onChange: (value: string) => void
  options: FilterDropdownOption[]
  className?: string
  /** 'light' = respektuje světlý/tmavý motiv stránky, 'dark' = vždy tmavé pozadí (např. leady) */
  variant?: 'light' | 'dark'
}

const VARIANT_CLS = {
  light: {
    button: 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white',
    buttonClosed: 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500',
    icon: 'text-gray-400 dark:text-slate-400',
    panel: 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600',
    option: 'text-gray-700 dark:text-slate-300',
    optionHighlighted: 'bg-gray-50 dark:bg-slate-700',
    optionSelected: 'text-primary dark:text-primary-light',
  },
  dark: {
    button: 'bg-[#1e2638] text-white',
    buttonClosed: 'border-white/20 hover:border-white/30',
    icon: 'text-white/50',
    panel: 'bg-[#1e2638] border-white/20',
    option: 'text-white/80',
    optionHighlighted: 'bg-white/10',
    optionSelected: 'text-primary-light',
  },
} as const

/** Vlastní stylovaný dropdown pro filtry — na rozdíl od native <select> jde nastylovat i otevřený panel. */
export default function FilterDropdown({ value, onChange, options, className = '', variant = 'light' }: FilterDropdownProps) {
  const v = VARIANT_CLS[variant]
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const selectedIndex = useMemo(() => Math.max(0, options.findIndex(o => o.value === value)), [options, value])
  const selectedLabel = options[selectedIndex]?.label ?? ''

  useEffect(() => {
    if (!open) return
    setHighlighted(selectedIndex)
    function handler(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, selectedIndex])

  function select(i: number) {
    const opt = options[i]
    if (!opt) return
    onChange(opt.value)
    setOpen(false)
    btnRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      btnRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(i => Math.min(options.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(i => Math.max(0, i - 1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select(highlighted)
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border pl-3 pr-2.5 py-2 text-sm text-left transition-colors ${v.button} ${
          open ? 'border-primary ring-2 ring-primary/30' : v.buttonClosed
        }`}
      >
        <span className="truncate">{selectedLabel}</span>
        <IconChevronDown className={`w-3.5 h-3.5 flex-shrink-0 ${v.icon} transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="listbox"
          className={`absolute left-0 top-full mt-1.5 z-50 min-w-full w-max max-w-xs border rounded-xl shadow-lg py-1 overflow-y-auto ${v.panel}`}
          style={{ maxHeight: 320 }}
        >
          {options.map((o, i) => {
            const selected = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => select(i)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  i === highlighted ? v.optionHighlighted : ''
                } ${selected ? `${v.optionSelected} font-medium` : v.option}`}
              >
                <IconCheck className={`w-3.5 h-3.5 flex-shrink-0 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                <span className="truncate">{o.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
