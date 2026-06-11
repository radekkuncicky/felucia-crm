'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import DealsTable from './DealsTable'
import DealsKanban, { KanbanDeal } from './DealsKanban'

// KanbanDeal is a superset of what DealsTable needs
interface Props {
  deals: KanbanDeal[]
  isAdmin?: boolean
}

export default function DealsPageClient({ deals, isAdmin = false }: Props) {
  const searchParams = useSearchParams()
  const [view, setView] = useState<'table' | 'kanban'>('table')

  useEffect(() => {
    const fromUrl = searchParams.get('view')
    if (fromUrl === 'kanban' || fromUrl === 'table') { setView(fromUrl); return }
    const saved = localStorage.getItem('deals-view')
    if (saved === 'kanban' || saved === 'table') setView(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function switchView(v: 'table' | 'kanban') {
    setView(v)
    localStorage.setItem('deals-view', v)
  }

  return (
    <div className="space-y-4">
      {/* FAB — mobile only */}
      <Link
        href="/deals/new"
        className="fab-bottom fixed right-4 z-40 w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg flex items-center justify-center md:hidden transition-colors"
        style={{ paddingBottom: 0 }}
        aria-label="Nový případ"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </Link>

      {/* View toggle — desktop only */}
      <div className="hidden sm:flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
        <button
          onClick={() => switchView('table')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            view === 'table'
              ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
          </svg>
          Tabulka
        </button>
        <button
          onClick={() => switchView('kanban')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            view === 'kanban'
              ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          Kanban
        </button>
      </div>

      {view === 'table' ? (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <DealsTable deals={deals as any} isAdmin={isAdmin} />
      ) : (
        <DealsKanban deals={deals} />
      )}
    </div>
  )
}
