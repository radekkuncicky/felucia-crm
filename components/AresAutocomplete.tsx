'use client'

import { useState, useRef, useEffect } from 'react'
import { useAresLookup, type AresFirma } from '@/hooks/useAresLookup'

interface Props {
  onSelect: (firma: AresFirma) => void
  placeholder?: string
}

export default function AresAutocomplete({ onSelect, placeholder = 'Název firmy nebo IČO' }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { results, loading } = useAresLookup(query)

  useEffect(() => {
    setOpen(query.trim().length >= 2)
  }, [query, results])

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  function handleSelect(firma: AresFirma) {
    onSelect(firma)
    setQuery('')
    setOpen(false)
  }

  const showDropdown = open && query.trim().length >= 2

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder={placeholder}
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400"
        />
        {loading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden max-h-72 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">Hledám…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">Žádné výsledky</div>
          ) : (
            results.slice(0, 8).map(firma => (
              <button
                key={firma.ico}
                type="button"
                onClick={() => handleSelect(firma)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 border-b border-gray-100 dark:border-slate-700 last:border-0 transition-colors"
              >
                <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{firma.nazev}</div>
                <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  IČO: {firma.ico}{firma.mesto ? ` · ${firma.mesto}` : ''}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
