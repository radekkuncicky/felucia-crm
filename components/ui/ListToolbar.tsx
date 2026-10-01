'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { NativeFilterContext } from './FilterDropdown'

interface ListToolbarProps {
  search: string
  onSearch: (value: string) => void
  searchPlaceholder: string
  /** Filtry (FilterDropdown, data…) — desktop v řádku, mobil v panelu „Filtry“ */
  children?: React.ReactNode
  /** Počet aktivních filtrů mimo hledání (číslo na tlačítku Filtry) */
  activeCount?: number
  onReset?: () => void
  /** Rychlé čipy nad lištou — na mobilu jeden vodorovně posuvný řádek */
  chips?: React.ReactNode
  /** Akce vpravo (např. nastavení sloupců) — jen desktop */
  trailing?: React.ReactNode
  className?: string
}

/**
 * Lišta seznamu: na mobilu jen hledání + „Filtry (n)“ otevírající spodní panel,
 * aby první řádek seznamu nezačínal pod půlkou obrazovky. Desktop beze změny chování.
 */
export default function ListToolbar({
  search, onSearch, searchPlaceholder, children, activeCount = 0, onReset, chips, trailing, className,
}: ListToolbarProps) {
  const [open, setOpen] = useState(false)
  const hasFilters = !!children
  const canReset = !!onReset && (activeCount > 0 || !!search)

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {chips && (
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible scrollbar-none">
          {chips}
        </div>
      )}
      <div className="flex gap-2 sm:flex-wrap sm:items-center">
        <input
          type="search"
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="flex-1 min-w-0 sm:flex-none sm:w-64 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400"
        />
        {hasFilters && (
          <Button
            variant="secondary"
            className="sm:hidden flex-shrink-0"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
          >
            Filtry{activeCount > 0 ? ` (${activeCount})` : ''}
          </Button>
        )}
        {hasFilters && <div className="hidden sm:flex gap-2 flex-wrap items-center">{children}</div>}
        {canReset && (
          <button
            type="button"
            onClick={onReset}
            className="hidden sm:inline text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-2"
          >
            ✕ Zrušit filtry
          </button>
        )}
        {trailing && <div className="hidden sm:block ml-auto">{trailing}</div>}
      </div>

      {hasFilters && (
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Filtry"
          footer={
            <>
              {onReset && activeCount > 0 && (
                <Button variant="ghost" onClick={onReset}>Zrušit filtry</Button>
              )}
              <Button onClick={() => setOpen(false)}>Hotovo</Button>
            </>
          }
        >
          <NativeFilterContext.Provider value={true}>
            <div className="flex flex-col gap-3 [&>*]:w-full">{children}</div>
          </NativeFilterContext.Provider>
        </Dialog>
      )}
    </div>
  )
}
