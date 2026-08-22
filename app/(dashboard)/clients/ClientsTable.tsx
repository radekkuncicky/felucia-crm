'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useTableColumns, ColumnDef } from '@/hooks/useTableColumns'
import ColumnConfigButton from '@/components/ColumnConfigButton'
import { ResizeHandle } from '@/components/ResizeHandle'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/format'

interface ClientRow {
  id: string
  typKlienta: 'FYZICKA_OSOBA' | 'FIRMA'
  jmeno: string
  prijmeni: string
  telefon: string | null
  email: string | null
  ico: string | null
  mesto: string | null
  ulice: string | null
  psc: string | null
  dealCount: number
  vytvoreno: string
}

interface Props {
  clients: ClientRow[]
}

const DEFS: ColumnDef[] = [
  { id: 'jmeno', label: 'Jméno', defaultVisible: true, defaultWidth: 200 },
  { id: 'telefon', label: 'Telefon', defaultVisible: true, defaultWidth: 140 },
  { id: 'email', label: 'Email', defaultVisible: true, defaultWidth: 200 },
  { id: 'ico', label: 'IČO', defaultVisible: false, defaultWidth: 110 },
  { id: 'mesto', label: 'Město', defaultVisible: false, defaultWidth: 130 },
  { id: 'adresa', label: 'Adresa', defaultVisible: false, defaultWidth: 220 },
  { id: 'pripady', label: 'Případy', defaultVisible: true, defaultWidth: 100 },
  { id: 'vytvoreno', label: 'Vytvořen', defaultVisible: true, defaultWidth: 120 },
]

const TH = 'text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-6 py-3 relative select-none'

export default function ClientsTable({ clients }: Props) {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? 'anon'
  const { columns, visibleColumns, updateColumn, resizeColumn, resetColumns, reorderColumns } = useTableColumns(
    'clients',
    userId,
    DEFS
  )

  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return clients
    const q = search.toLowerCase()
    return clients.filter(c =>
      c.jmeno.toLowerCase().includes(q) ||
      c.prijmeni.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.telefon ?? '').toLowerCase().includes(q) ||
      (c.ico ?? '').toLowerCase().includes(q) ||
      (c.mesto ?? '').toLowerCase().includes(q)
    )
  }, [clients, search])


  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="Hledat (jméno, email, telefon, IČO, město)…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-80 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 flex-shrink-0">✕ Zrušit</button>
        )}
        <span className="text-sm text-gray-500 dark:text-slate-400 ml-auto flex-shrink-0">{filtered.length} klientů</span>
        <ColumnConfigButton
          columns={columns}
          defs={DEFS}
          onToggle={(id, visible) => updateColumn(id, { visible })}
          onReorder={reorderColumns}
          onReset={resetColumns}
        />
      </div>

      {/* Mobile card layout */}
      <div className="sm:hidden bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700">
        {filtered.length === 0 && (
          clients.length === 0 ? (
            <EmptyState
              title="Zatím žádní klienti"
              description="Přidejte prvního klienta — u firem se údaje načtou automaticky z ARES podle IČO."
              actionLabel="+ Přidat klienta"
              actionHref="/clients/new"
            />
          ) : (
            <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-slate-500">Žádní klienti neodpovídají hledání.</div>
          )
        )}
        {filtered.map(client => (
          <div key={client.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {client.typKlienta === 'FIRMA' ? client.jmeno : `${client.jmeno} ${client.prijmeni}`.trim()}
                  </p>
                  {client.typKlienta === 'FIRMA' && (
                    <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Firma</span>
                  )}
                </div>
                {client.telefon && (
                  <a href={`tel:${client.telefon}`} className="text-sm text-gray-500 dark:text-slate-400 block">{client.telefon}</a>
                )}
                {client.email && (
                  <a
                    href={`mailto:${client.email}`}
                    onClick={e => e.stopPropagation()}
                    className="text-sm text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline truncate block"
                  >
                    {client.email}
                  </a>
                )}
                {client.mesto && (
                  <p className="text-xs text-gray-400 dark:text-slate-500">{client.mesto}</p>
                )}
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{formatDate(client.vytvoreno)}</p>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap">
                  {client.dealCount} případů
                </span>
                <Link href={`/clients/${client.id}`} className="text-sm text-green-600 hover:text-green-800 dark:hover:text-green-400 font-medium">Detail →</Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              {visibleColumns.map(col => (
                <col key={col.id} style={{ width: col.width ?? undefined }} />
              ))}
              <col style={{ width: 80 }} />
            </colgroup>
            <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
              <tr>
                {visibleColumns.map(col => (
                  <th key={col.id} className={TH} style={{ width: col.width ?? undefined }}>
                    {DEFS.find(d => d.id === col.id)?.label}
                    <ResizeHandle onResize={dx => resizeColumn(col.id, dx)} />
                  </th>
                ))}
                <th className="px-6 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length + 1}>
                    {clients.length === 0 ? (
                      <EmptyState
                        title="Zatím žádní klienti"
                        description="Přidejte prvního klienta — u firem se údaje načtou automaticky z ARES podle IČO."
                        actionLabel="+ Přidat klienta"
                        actionHref="/clients/new"
                      />
                    ) : (
                      <div className="px-6 py-8 text-center text-sm text-gray-400 dark:text-slate-500">Žádní klienti neodpovídají hledání.</div>
                    )}
                  </td>
                </tr>
              )}
              {filtered.map(client => (
                <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                  {visibleColumns.map(col => {
                    switch (col.id) {
                      case 'jmeno':
                        return (
                          <td key={col.id} className="px-6 py-4 overflow-hidden">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-gray-900 dark:text-white truncate">
                                {client.typKlienta === 'FIRMA' ? client.jmeno : `${client.jmeno} ${client.prijmeni}`.trim()}
                              </p>
                              {client.typKlienta === 'FIRMA' && (
                                <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Firma</span>
                              )}
                            </div>
                          </td>
                        )
                      case 'telefon':
                        return <td key={col.id} className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400 truncate overflow-hidden">{client.telefon ?? '—'}</td>
                      case 'email':
                        return (
                          <td key={col.id} className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400 truncate overflow-hidden">
                            {client.email
                              ? <a href={`mailto:${client.email}`} onClick={e => e.stopPropagation()} className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline">{client.email}</a>
                              : '—'}
                          </td>
                        )
                      case 'ico':
                        return <td key={col.id} className="px-6 py-4 text-sm font-mono text-gray-600 dark:text-slate-400 overflow-hidden">{client.ico ?? '—'}</td>
                      case 'mesto':
                        return <td key={col.id} className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400 truncate overflow-hidden">{client.mesto ?? '—'}</td>
                      case 'adresa':
                        return (
                          <td key={col.id} className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400 truncate overflow-hidden">
                            {[client.ulice, [client.mesto, client.psc].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—'}
                          </td>
                        )
                      case 'pripady':
                        return (
                          <td key={col.id} className="px-6 py-4">
                            <span className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap">
                              {client.dealCount} případů
                            </span>
                          </td>
                        )
                      case 'vytvoreno':
                        return <td key={col.id} className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400 whitespace-nowrap">{formatDate(client.vytvoreno)}</td>
                      default:
                        return <td key={col.id} />
                    }
                  })}
                  <td className="px-6 py-4 text-right">
                    <Link href={`/clients/${client.id}`} className="text-sm text-green-600 hover:text-green-800 dark:hover:text-green-400 font-medium">Detail →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
