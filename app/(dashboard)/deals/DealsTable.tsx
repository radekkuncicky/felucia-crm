'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { StavDealu, Technologie } from '@prisma/client'
import { stavLabels, techLabels, techColors } from '@/lib/constants'
import { useTableColumns, ColumnDef } from '@/hooks/useTableColumns'
import ColumnConfigButton from '@/components/ColumnConfigButton'
import InlineStatusBadge from '@/components/InlineStatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import FilterDropdown from '@/components/ui/FilterDropdown'
import { ResizeHandle } from '@/components/ResizeHandle'
import { formatDate, formatKcPresne } from '@/lib/format'

interface DealRow {
  id: string
  kod: string | null
  predmet: string | null
  stav: StavDealu
  technologie: Technologie
  dphSazba: number
  clientJmeno: string
  userJmeno: string | null
  konecnaCena: number
  konecnaCenaSDph: number
  marzeProc?: number | null
  vytvoreno: string
  terminRealizace: string | null
}

interface Props {
  deals: DealRow[]
  showZneplatnene?: boolean
  showMarze?: boolean
}

type SortKey = 'kod' | 'predmet' | 'stav' | 'technologie' | 'konecnaCena' | 'cenaSDph' | 'vytvoreno' | 'pravdepodobnost' | 'marze'

const stavOptions: StavDealu[] = ['NOVY', 'JEDNANI', 'NABIDKA', 'PRED_UZAVRENIM', 'USPECH', 'PAS', 'ZNEPLATNENO']
const techOptions: Technologie[] = ['KLIMA', 'TEPELNE_CERPADLO', 'REKUPERACE', 'PODLAHOVE_TOPENI', 'VZDUCHOTECHNIKA', 'JINE']
const PAGE_SIZES = [50, 100, 200]

const pravdepodobnostMap: Record<StavDealu, number> = {
  NOVY: 10,
  JEDNANI: 25,
  NABIDKA: 50,
  PRED_UZAVRENIM: 75,
  USPECH: 100,
  PAS: 0,
  ZNEPLATNENO: 0,
}

const fmtKc = formatKcPresne

function thisYear(dateStr: string) {
  return new Date(dateStr).getFullYear() === new Date().getFullYear()
}

type QuickFilter = '' | 'vyhraLetos' | 'uzavreniLetos' | 'aktivni' | 'vyrizene' | 'zneplatnene'

const DEFS: ColumnDef[] = [
  { id: 'kod', label: 'Kód', defaultVisible: true, defaultWidth: 96 },
  { id: 'predmet', label: 'Předmět', defaultVisible: true, defaultWidth: 190 },
  { id: 'klient', label: 'Klient', defaultVisible: true, defaultWidth: 150 },
  { id: 'stav', label: 'Stav', defaultVisible: true, defaultWidth: 130 },
  { id: 'technologie', label: 'Kategorie', defaultVisible: true, defaultWidth: 130 },
  { id: 'konecnaCena', label: 'Konečná cena', defaultVisible: true, defaultWidth: 130 },
  { id: 'cenaSDph', label: 'Celkem s DPH', defaultVisible: true, defaultWidth: 130 },
  { id: 'pravdepodobnost', label: 'Pravděp.', defaultVisible: true, defaultWidth: 110 },
  { id: 'uzavreno', label: 'Uzavřeno', defaultVisible: true, defaultWidth: 110 },
  { id: 'vlastnik', label: 'Vlastník', defaultVisible: true, defaultWidth: 110 },
  { id: 'marze', label: 'Marže', defaultVisible: false, defaultWidth: 90 },
]


export default function DealsTable({ deals, showZneplatnene = false, showMarze = false }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const userId = session?.user?.id ?? 'anon'
  const { columns, visibleColumns, updateColumn, resizeColumn, resetColumns, reorderColumns } = useTableColumns(
    'deals',
    userId,
    showMarze ? DEFS : DEFS.filter(d => d.id !== 'marze')
  )

  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [filterStav, setFilterStav] = useState(searchParams.get('stav') ?? '')
  const [filterTech, setFilterTech] = useState(searchParams.get('tech') ?? '')
  const [filterUser, setFilterUser] = useState(searchParams.get('vlastnik') ?? '')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>((searchParams.get('filtr') as QuickFilter) ?? '')

  // Filtry do URL — refresh i sdílení odkazu zachová pohled
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const set = (key: string, val: string) => {
      if (val) params.set(key, val)
      else params.delete(key)
    }
    set('q', search)
    set('stav', filterStav)
    set('tech', filterTech)
    set('vlastnik', filterUser)
    set('filtr', quickFilter)
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [search, filterStav, filterTech, filterUser, quickFilter])
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'vytvoreno', dir: 'desc' })
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)
  const [stavOverrides, setStavOverrides] = useState<Record<string, StavDealu>>({})

  function toggleSort(key: SortKey) {
    setPage(1)
    setSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  function setQuick(qf: QuickFilter) {
    setQuickFilter(prev => prev === qf ? '' : qf)
    setPage(1)
  }

  const filtered = useMemo(() => {
    let rows = deals
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(d =>
        d.kod?.toLowerCase().includes(q) ||
        d.predmet?.toLowerCase().includes(q) ||
        d.clientJmeno.toLowerCase().includes(q)
      )
    }
    if (filterStav) rows = rows.filter(d => (stavOverrides[d.id] ?? d.stav) === filterStav)
    if (filterTech) rows = rows.filter(d => d.technologie === filterTech)
    if (filterUser) rows = rows.filter(d => d.userJmeno === filterUser)
    if (quickFilter === 'zneplatnene') {
      rows = rows.filter(d => (stavOverrides[d.id] ?? d.stav) === 'ZNEPLATNENO')
    } else {
      // By default, hide ZNEPLATNENO unless explicitly filtered
      rows = rows.filter(d => (stavOverrides[d.id] ?? d.stav) !== 'ZNEPLATNENO')
      if (quickFilter === 'vyhraLetos') rows = rows.filter(d => (stavOverrides[d.id] ?? d.stav) === 'USPECH' && thisYear(d.vytvoreno))
      if (quickFilter === 'uzavreniLetos') rows = rows.filter(d => (['USPECH', 'PAS'] as StavDealu[]).includes(stavOverrides[d.id] ?? d.stav) && thisYear(d.vytvoreno))
      if (quickFilter === 'aktivni') rows = rows.filter(d => !(['USPECH', 'PAS'] as StavDealu[]).includes(stavOverrides[d.id] ?? d.stav))
      if (quickFilter === 'vyrizene') rows = rows.filter(d => (['USPECH', 'PAS'] as StavDealu[]).includes(stavOverrides[d.id] ?? d.stav))
    }

    rows = [...rows].sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''
      if (sort.key === 'kod') { va = a.kod ?? ''; vb = b.kod ?? '' }
      else if (sort.key === 'predmet') { va = a.predmet ?? ''; vb = b.predmet ?? '' }
      else if (sort.key === 'stav') { va = a.stav; vb = b.stav }
      else if (sort.key === 'technologie') { va = a.technologie; vb = b.technologie }
      else if (sort.key === 'konecnaCena') { va = a.konecnaCena; vb = b.konecnaCena }
      else if (sort.key === 'cenaSDph') { va = a.konecnaCenaSDph; vb = b.konecnaCenaSDph }
      else if (sort.key === 'vytvoreno') { va = a.vytvoreno; vb = b.vytvoreno }
      else if (sort.key === 'pravdepodobnost') { va = pravdepodobnostMap[a.stav]; vb = pravdepodobnostMap[b.stav] }
      else if (sort.key === 'marze') { va = a.marzeProc ?? -1; vb = b.marzeProc ?? -1 }

      if (va < vb) return sort.dir === 'asc' ? -1 : 1
      if (va > vb) return sort.dir === 'asc' ? 1 : -1
      return 0
    })
    return rows
  }, [deals, search, filterStav, filterTech, filterUser, quickFilter, sort, stavOverrides])

  const stats = useMemo(() => {
    const rozjednano = filtered.filter(d => !['USPECH', 'PAS'].includes(d.stav))
    const uspech = filtered.filter(d => d.stav === 'USPECH')
    const pas = filtered.filter(d => d.stav === 'PAS')
    const sum = (rows: DealRow[]) => rows.reduce((s, d) => s + d.konecnaCena, 0)
    return {
      total: filtered.length,
      rozjednano: { count: rozjednano.length, sum: sum(rozjednano) },
      uspech: { count: uspech.length, sum: sum(uspech) },
      pas: { count: pas.length, sum: sum(pas) },
    }
  }, [filtered])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  function resetPage() { setPage(1) }

  function SortIcon({ k }: { k: SortKey }) {
    if (sort.key !== k) return <span className="text-gray-300 dark:text-slate-600 ml-1">↕</span>
    return <span className="text-green-600 dark:text-green-400 ml-1">{sort.dir === 'asc' ? '↑' : '↓'}</span>
  }

  const uniqueUsers = Array.from(new Set(deals.map(d => d.userJmeno).filter(Boolean))) as string[]

  const stavFilterOptions = [
    { value: '', label: 'Stav' },
    ...stavOptions.filter(s => s !== 'ZNEPLATNENO' || showZneplatnene).map(s => ({ value: s, label: stavLabels[s] })),
  ]
  const techFilterOptions = [
    { value: '', label: 'Kategorie' },
    ...techOptions.map(t => ({ value: t, label: techLabels[t] })),
  ]
  const userFilterOptions = [
    { value: '', label: 'Vlastník' },
    ...uniqueUsers.map(u => ({ value: u, label: u })),
  ]

  const quickFilters: { key: QuickFilter; label: string }[] = [
    { key: 'vyhraLetos', label: 'Výhra tento rok' },
    { key: 'uzavreniLetos', label: 'Uzavřeno tento rok' },
    { key: 'aktivni', label: 'Aktivní' },
    { key: 'vyrizene', label: 'Vyřízené' },
    ...(showZneplatnene ? [{ key: 'zneplatnene' as QuickFilter, label: 'Zneplatněné' }] : []),
  ]


  const sortableColumns: Partial<Record<string, SortKey>> = {
    kod: 'kod',
    predmet: 'predmet',
    stav: 'stav',
    technologie: 'technologie',
    konecnaCena: 'konecnaCena',
    cenaSDph: 'cenaSDph',
    pravdepodobnost: 'pravdepodobnost',
    marze: 'marze',
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Quick pill filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {quickFilters.map(qf => (
          <button
            key={qf.key}
            onClick={() => setQuick(qf.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              quickFilter === qf.key
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-green-400 hover:text-green-600'
            }`}
          >
            {qf.label}
          </button>
        ))}
      </div>

      {/* Dropdown filters + search */}
      <div className="flex flex-col sm:flex-row gap-2 sm:flex-wrap sm:items-center">
        <input
          type="search"
          placeholder="Hledat (kód, předmět, klient)…"
          value={search}
          onChange={e => { setSearch(e.target.value); resetPage() }}
          className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-56 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400"
        />
        <div className="flex gap-2 flex-wrap flex-1">
          <FilterDropdown
            value={filterStav}
            onChange={v => { setFilterStav(v); resetPage() }}
            options={stavFilterOptions}
            className="flex-1 sm:flex-none"
          />
          <FilterDropdown
            value={filterTech}
            onChange={v => { setFilterTech(v); resetPage() }}
            options={techFilterOptions}
            className="flex-1 sm:flex-none"
          />
          <FilterDropdown
            value={filterUser}
            onChange={v => { setFilterUser(v); resetPage() }}
            options={userFilterOptions}
            className="flex-1 sm:flex-none"
          />
          {(search || filterStav || filterTech || filterUser || quickFilter) && (
            <button
              onClick={() => { setSearch(''); setFilterStav(''); setFilterTech(''); setFilterUser(''); setQuickFilter(''); resetPage() }}
              className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-2"
            >
              ✕ Zrušit filtry
            </button>
          )}
          <div className="ml-auto">
            <ColumnConfigButton
              columns={columns}
              defs={DEFS}
              onToggle={(id, vis) => updateColumn(id, { visible: vis })}
              onReorder={reorderColumns}
              onReset={resetColumns}
            />
          </div>
        </div>
      </div>

      {/* Mobile card layout */}
      <div className="sm:hidden bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        {paged.length === 0 ? (
          deals.length === 0 ? (
            <EmptyState
              title="Zatím žádné obchodní případy"
              description="Vytvořte první obchodní případ. Nabídky a smlouvy k němu připojíte v detailu — po výhře vznikne zakázka automaticky."
              actionLabel="+ Nový případ"
              actionHref="/deals/new"
            />
          ) : (
            <div className="py-10 text-center text-sm text-gray-400 dark:text-slate-500">Žádné výsledky — zkuste upravit filtry.</div>
          )
        ) : paged.map((deal) => {
          const effectiveStavMobile = stavOverrides[deal.id] ?? deal.stav
          const cenaSDph = deal.konecnaCenaSDph
          return (
            <div
              key={deal.id}
              onClick={() => router.push(`/deals/${deal.id}`)}
              className={`flex flex-col gap-1.5 px-4 py-3 border-b border-gray-100 dark:border-slate-700 last:border-0 cursor-pointer active:bg-gray-50 dark:active:bg-slate-700 ${effectiveStavMobile === 'ZNEPLATNENO' ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs font-semibold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded flex-shrink-0">
                    {deal.kod ?? '—'}
                  </span>
                  <div onClick={e => e.stopPropagation()}>
                    <InlineStatusBadge
                      dealId={deal.id}
                      stav={effectiveStavMobile}
                      onChange={newStav => setStavOverrides(prev => ({ ...prev, [deal.id]: newStav }))}
                    />
                  </div>
                </div>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${techColors[deal.technologie]}`}>
                  {techLabels[deal.technologie]}
                </span>
              </div>
              <p className={`text-sm font-medium text-gray-900 dark:text-slate-100 truncate ${effectiveStavMobile === 'ZNEPLATNENO' ? 'line-through' : ''}`}>
                {deal.predmet ?? '—'}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                <span className="truncate">{deal.clientJmeno}</span>
                <span className="font-semibold text-gray-800 dark:text-slate-200 flex-shrink-0 ml-2">
                  {deal.konecnaCena > 0 ? fmtKc(cenaSDph) : '—'}
                </span>
              </div>
            </div>
          )
        })}
        {/* Mobile stats + pagination */}
        <div className="border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-4 py-2 flex items-center justify-between gap-2 text-xs">
          <span className="text-gray-600 dark:text-slate-400">
            <span className="font-semibold text-gray-900 dark:text-white">{stats.total}</span> OP
            {' · '}
            <span className="text-green-700 dark:text-green-400 font-semibold">{fmtKc(stats.uspech.sum)}</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-slate-400">{safePage}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} className="w-6 h-6 flex items-center justify-center border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 text-gray-700 dark:text-slate-300">‹</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="w-6 h-6 flex items-center justify-center border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 text-gray-700 dark:text-slate-300">›</button>
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ tableLayout: 'fixed', minWidth: 600 }}>
            <colgroup>
              {visibleColumns.map(col => (
                <col key={col.id} style={{ width: col.width ?? undefined }} />
              ))}
            </colgroup>
            <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
              <tr>
                {visibleColumns.map(col => {
                  const sortKey = sortableColumns[col.id]
                  return (
                    <th
                      key={col.id}
                      onClick={sortKey ? () => toggleSort(sortKey) : undefined}
                      className={`text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-4 py-3 relative select-none whitespace-nowrap ${
                        ['konecnaCena', 'cenaSDph', 'pravdepodobnost', 'marze'].includes(col.id) ? 'text-right' : 'text-left'
                      } ${sortKey ? 'cursor-pointer hover:text-gray-700 dark:hover:text-slate-200' : ''}`}
                    >
                      {DEFS.find(d => d.id === col.id)?.label}
                      {sortKey && <SortIcon k={sortKey} />}
                      <ResizeHandle onResize={dx => resizeColumn(col.id, dx)} />
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {paged.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length}>
                    {deals.length === 0 ? (
                      <EmptyState
                        title="Zatím žádné obchodní případy"
                        description="Vytvořte první obchodní případ. Nabídky a smlouvy k němu připojíte v detailu — po výhře vznikne zakázka automaticky."
                        actionLabel="+ Nový případ"
                        actionHref="/deals/new"
                      />
                    ) : (
                      <div className="px-4 py-10 text-center text-sm text-gray-400 dark:text-slate-500">Žádné výsledky — zkuste upravit filtry.</div>
                    )}
                  </td>
                </tr>
              )}
              {paged.map((deal) => {
                const effectiveStav = stavOverrides[deal.id] ?? deal.stav
                const cenaSDph = deal.konecnaCenaSDph
                const pravd = pravdepodobnostMap[effectiveStav]
                return (
                  <tr
                    key={deal.id}
                    onClick={() => router.push(`/deals/${deal.id}`)}
                    className={`hover:bg-[#F4FAF4] dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${effectiveStav === 'ZNEPLATNENO' ? 'opacity-60' : ''}`}
                  >
                    {visibleColumns.map(col => {
                      switch (col.id) {
                        case 'kod':
                          return (
                            <td key={col.id} className="px-4 py-3 overflow-hidden">
                              <span className="font-mono text-xs font-semibold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                {deal.kod ?? '—'}
                              </span>
                            </td>
                          )
                        case 'predmet':
                          return (
                            <td key={col.id} className="px-4 py-3 overflow-hidden">
                              <p className={`text-sm font-medium text-gray-900 dark:text-slate-100 truncate ${effectiveStav === 'ZNEPLATNENO' ? 'line-through' : ''}`} title={deal.predmet ?? undefined}>
                                {deal.predmet ?? '—'}
                              </p>
                            </td>
                          )
                        case 'klient':
                          return (
                            <td key={col.id} className="px-4 py-3 overflow-hidden">
                              <p className="text-sm text-gray-600 dark:text-slate-300 truncate">{deal.clientJmeno}</p>
                            </td>
                          )
                        case 'stav':
                          return (
                            <td key={col.id} className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                              <InlineStatusBadge
                                dealId={deal.id}
                                stav={effectiveStav}
                                onChange={newStav => setStavOverrides(prev => ({ ...prev, [deal.id]: newStav }))}
                              />
                            </td>
                          )
                        case 'technologie':
                          return (
                            <td key={col.id} className="px-4 py-3 whitespace-nowrap">
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${techColors[deal.technologie]}`}>
                                {techLabels[deal.technologie]}
                              </span>
                            </td>
                          )
                        case 'konecnaCena':
                          return (
                            <td key={col.id} className="px-4 py-3 whitespace-nowrap text-right text-sm font-semibold text-gray-900 dark:text-slate-100">
                              {deal.konecnaCena > 0 ? fmtKc(deal.konecnaCena) : '—'}
                            </td>
                          )
                        case 'cenaSDph':
                          return (
                            <td key={col.id} className="px-4 py-3 whitespace-nowrap text-right text-sm font-semibold text-green-700 dark:text-green-400">
                              {deal.konecnaCena > 0 ? fmtKc(cenaSDph) : '—'}
                            </td>
                          )
                        case 'pravdepodobnost':
                          return (
                            <td key={col.id} className="px-4 py-3 whitespace-nowrap text-right">
                              <span className={`text-sm font-semibold ${pravd === 100 ? 'text-green-600' : pravd === 0 ? 'text-red-500' : 'text-gray-700 dark:text-slate-300'}`}>
                                {pravd} %
                              </span>
                            </td>
                          )
                        case 'uzavreno':
                          return (
                            <td key={col.id} className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                              {deal.terminRealizace ? formatDate(deal.terminRealizace) : '—'}
                            </td>
                          )
                        case 'vlastnik':
                          return (
                            <td key={col.id} className="px-4 py-3 overflow-hidden">
                              <span className="text-sm text-gray-600 dark:text-slate-400 truncate block">{deal.userJmeno ?? '—'}</span>
                            </td>
                          )
                        case 'marze': {
                          const mp = deal.marzeProc
                          return (
                            <td key={col.id} className="px-4 py-3 whitespace-nowrap text-right">
                              {mp !== null && mp !== undefined ? (
                                <span className={`text-sm font-semibold ${mp >= 30 ? 'text-green-600 dark:text-green-400' : mp >= 15 ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {mp.toFixed(1)} %
                                </span>
                              ) : <span className="text-gray-400 dark:text-slate-600 text-sm">—</span>}
                            </td>
                          )
                        }
                        default:
                          return <td key={col.id} />
                      }
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-4 py-2 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 text-xs flex-wrap">
            <span className="font-semibold text-gray-700 dark:text-slate-300">
              POČET <span className="text-gray-900 dark:text-white">{stats.total}</span>
            </span>
            <span className="text-gray-400 dark:text-slate-600">|</span>
            <span className="text-gray-600 dark:text-slate-400">
              ROZJEDNÁNO ZA{' '}
              <span className="font-semibold text-gray-800 dark:text-slate-200">{fmtKc(stats.rozjednano.sum)}</span>{' '}
              <span className="text-gray-400">({stats.rozjednano.count})</span>
            </span>
            <span className="text-gray-400 dark:text-slate-600">|</span>
            <span className="text-green-700 dark:text-green-400">
              <span className="font-semibold">{fmtKc(stats.uspech.sum)}</span>{' '}
              <span className="opacity-70">({stats.uspech.count})</span>
            </span>
            <span className="text-gray-400 dark:text-slate-600">|</span>
            <span className="text-red-600 dark:text-red-400">
              <span className="font-semibold">{fmtKc(stats.pas.sum)}</span>{' '}
              <span className="opacity-70">({stats.pas.count})</span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500 dark:text-slate-400">Na stránce</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none"
            >
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-gray-500 dark:text-slate-400">
              Stránka <span className="font-semibold text-gray-900 dark:text-slate-100">{safePage}</span> z{' '}
              <span className="font-semibold text-gray-900 dark:text-slate-100">{totalPages}</span>
            </span>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} className="w-6 h-6 flex items-center justify-center border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 dark:text-slate-300">‹</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="w-6 h-6 flex items-center justify-center border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 dark:text-slate-300">›</button>
          </div>
        </div>
      </div>
    </div>
  )
}
