'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface SearchResult {
  type: 'deal' | 'client'
  id: string
  label: string
  sub: string
  href: string
}

interface Group {
  label: string
  items: Item[]
}

interface Item {
  id: string
  icon: React.ReactNode
  label: string
  sub?: string
  shortcut?: string
  href?: string
  action?: () => void
}

const ICON_DEAL = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
)
const ICON_CLIENT = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)
const ICON_PLUS = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)
const ICON_NAV = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" />
  </svg>
)

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const helpRef = useRef<HTMLDivElement>(null)

  // Global keyboard shortcuts
  useEffect(() => {
    function isInInput() {
      const el = document.activeElement
      return el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT' || (el as HTMLElement)?.isContentEditable
    }
    function handler(e: KeyboardEvent) {
      // Cmd+K / Ctrl+K → toggle palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
        return
      }
      if (e.key === 'Escape') {
        setOpen(false)
        setHelpOpen(false)
        return
      }
      // Shortcuts only when not in an input field
      if (isInInput()) return
      // / → open palette
      if (e.key === '/') {
        e.preventDefault()
        setOpen(o => !o)
        return
      }
      // n → new deal
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        router.push('/deals/new')
        return
      }
    }
    function openHandler() { setOpen(true) }
    document.addEventListener('keydown', handler)
    window.addEventListener('felucia:command-palette', openHandler)
    return () => {
      document.removeEventListener('keydown', handler)
      window.removeEventListener('felucia:command-palette', openHandler)
    }
  }, [router])

  // Close help on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false)
      }
    }
    if (helpOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [helpOpen])

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const [dealsRes, clientsRes] = await Promise.all([
        fetch(`/api/deals?search=${encodeURIComponent(q)}`),
        fetch(`/api/clients?search=${encodeURIComponent(q)}`),
      ])
      const dealsData = dealsRes.ok ? await dealsRes.json() : []
      const clientsData = clientsRes.ok ? await clientsRes.json() : []

      const mapped: SearchResult[] = [
        ...dealsData.slice(0, 5).map((d: { id: string; kod: string | null; predmet: string | null }) => ({
          type: 'deal' as const,
          id: d.id,
          label: d.predmet ?? 'Bez předmětu',
          sub: d.kod ?? '',
          href: `/deals/${d.id}`,
        })),
        ...clientsData.slice(0, 5).map((c: { id: string; jmeno: string; prijmeni: string; email: string | null }) => ({
          type: 'client' as const,
          id: c.id,
          label: `${c.jmeno} ${c.prijmeni}`,
          sub: c.email ?? '',
          href: `/clients/${c.id}`,
        })),
      ]
      setResults(mapped)
      setActiveIdx(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => search(query), 300)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [query, search])

  function navigate(href: string) {
    router.push(href)
    setOpen(false)
  }

  const staticGroups: Group[] = [
    {
      label: 'Přejít na',
      items: [
        { id: 'nav-dashboard', icon: ICON_NAV, label: 'Nástěnka', shortcut: '⌘1', href: '/dashboard' },
        { id: 'nav-deals', icon: ICON_DEAL, label: 'Obchodní případy', shortcut: '⌘2', href: '/deals' },
        { id: 'nav-clients', icon: ICON_CLIENT, label: 'Klienti', shortcut: '⌘3', href: '/clients' },
        { id: 'nav-activities', icon: ICON_NAV, label: 'Aktivity', shortcut: '⌘4', href: '/activities' },
        { id: 'nav-calendar', icon: ICON_NAV, label: 'Kalendář', href: '/calendar' },
        { id: 'nav-settings', icon: ICON_NAV, label: 'Nastavení', href: '/settings' },
      ],
    },
    {
      label: 'Rychlé akce',
      items: [
        { id: 'act-new-deal', icon: ICON_PLUS, label: 'Nový obchodní případ', href: '/deals/new' },
        { id: 'act-new-client', icon: ICON_PLUS, label: 'Nový klient', href: '/clients/new' },
      ],
    },
  ]

  // Build flat list for keyboard nav
  const searchItems: Item[] = results.map(r => ({
    id: r.id,
    icon: r.type === 'deal' ? ICON_DEAL : ICON_CLIENT,
    label: r.label,
    sub: r.sub,
    href: r.href,
  }))

  const hasSearch = query.length >= 2
  const allItems: Item[] = hasSearch
    ? searchItems
    : staticGroups.flatMap(g => g.items)
  const totalItems = allItems.length

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(totalItems - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = allItems[activeIdx]
      if (item?.href) navigate(item.href)
      else item?.action?.()
    }
  }

  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
  const mod = isMac ? '⌘' : 'Ctrl'

  return (
    <>
      {/* ? Keyboard shortcuts help button — desktop only */}
      <div ref={helpRef} className="fixed bottom-6 z-40 hidden md:block" style={{ right: 90 }}>
        <button
          onClick={() => setHelpOpen(v => !v)}
          className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 shadow-md text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white flex items-center justify-center text-sm font-semibold transition-colors"
          title="Klávesové zkratky"
        >
          ?
        </button>
        {helpOpen && (
          <div className="absolute bottom-10 right-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl p-3 min-w-[200px]">
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">Klávesové zkratky</p>
            <div className="space-y-1">
              {[
                [`${mod}+K`, 'Hledat'],
                ['/', 'Hledat'],
                ['N', 'Nový OP'],
                ['Esc', 'Zavřít'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-gray-500 dark:text-slate-400">{label}</span>
                  <kbd className="bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-600 rounded px-1.5 py-0.5 font-mono">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    {open && (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
      style={{ background: 'rgba(10,18,10,0.6)' }}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-[560px] rounded-2xl border border-[#C8E6C9] bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#C8E6C9] dark:border-slate-700">
          <svg className="w-5 h-5 text-gray-400 dark:text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0) }}
            onKeyDown={handleKey}
            placeholder="Hledat nebo zadat příkaz…"
            className="flex-1 bg-transparent text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none"
          />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {loading && <span className="w-4 h-4 border-2 border-[#4CAF50] border-t-transparent rounded-full animate-spin" />}
            <kbd className="text-xs text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-600 rounded px-1.5 py-0.5 font-mono">Esc</kbd>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto py-2">
          {hasSearch ? (
            results.length === 0 && !loading ? (
              <p className="text-sm text-center text-gray-400 dark:text-slate-500 py-8">Žádné výsledky pro &ldquo;{query}&rdquo;</p>
            ) : (
              <div>
                {results.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-slate-500 px-4 py-1.5 font-semibold">Výsledky hledání</p>
                    {searchItems.map((item, i) => (
                      <ResultRow key={item.id} item={item} active={i === activeIdx} onHover={() => setActiveIdx(i)} onClick={() => item.href && navigate(item.href)} />
                    ))}
                  </div>
                )}
              </div>
            )
          ) : (
            staticGroups.map((group, gi) => {
              const offset = staticGroups.slice(0, gi).reduce((s, g) => s + g.items.length, 0)
              return (
                <div key={group.label}>
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-slate-500 px-4 py-1.5 font-semibold">{group.label}</p>
                  {group.items.map((item, i) => (
                    <ResultRow
                      key={item.id}
                      item={item}
                      active={offset + i === activeIdx}
                      onHover={() => setActiveIdx(offset + i)}
                      onClick={() => {
                        if (item.href) navigate(item.href)
                        else item.action?.()
                      }}
                    />
                  ))}
                </div>
              )
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-gray-100 dark:border-slate-800 px-4 py-2 flex items-center gap-4 text-[11px] text-gray-400 dark:text-slate-500">
          <span className="flex items-center gap-1"><kbd className="border border-gray-200 dark:border-slate-600 rounded px-1 font-mono">↑↓</kbd> navigace</span>
          <span className="flex items-center gap-1"><kbd className="border border-gray-200 dark:border-slate-600 rounded px-1 font-mono">↵</kbd> otevřít</span>
          <span className="flex items-center gap-1"><kbd className="border border-gray-200 dark:border-slate-600 rounded px-1 font-mono">Esc</kbd> zavřít</span>
        </div>
      </div>
    </div>
    )}
    </>
  )
}

function ResultRow({ item, active, onHover, onClick }: {
  item: Item
  active: boolean
  onHover: () => void
  onClick: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <button
      ref={ref}
      onMouseEnter={onHover}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        active ? 'bg-[#F4FAF4] dark:bg-slate-800' : 'hover:bg-gray-50 dark:hover:bg-slate-800/60'
      }`}
    >
      <span className={`flex-shrink-0 ${active ? 'text-[#4CAF50]' : 'text-gray-400 dark:text-slate-500'}`}>
        {item.icon}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate block">{item.label}</span>
        {item.sub && <span className="text-xs text-gray-400 dark:text-slate-500 truncate block">{item.sub}</span>}
      </div>
      {item.shortcut && (
        <kbd className="text-[11px] text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-600 rounded px-1.5 py-0.5 font-mono flex-shrink-0">{item.shortcut}</kbd>
      )}
    </button>
  )
}
