'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDate, formatKcPresne } from '@/lib/format'
import FilterDropdown from '@/components/ui/FilterDropdown'
import ObjednavkaDetail, { type ObjednavkaDto } from '@/components/objednavky/ObjednavkaDetail'
import { OBJ_STAV_LABELS, OBJ_STAV_COLORS } from './objednavkyStav'

/** Záložka Objednávky na /sklad — přehled všech objednávek org s detailem v panelu. */

interface Props {
  showNakupky: boolean
  search: string
  initialId?: string | null
}

const thCls = 'px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide'

export default function ObjednavkyTab({ showNakupky, search, initialId }: Props) {
  const [rows, setRows] = useState<ObjednavkaDto[] | null>(null)
  const [stavFilter, setStavFilter] = useState('otevrene')
  const [detailId, setDetailId] = useState<string | null>(initialId ?? null)
  const [meta, setMeta] = useState<{ canEdit: boolean; emailConfigured: boolean }>({ canEdit: false, emailConfigured: false })

  const load = useCallback(async () => {
    const q = stavFilter === 'otevrene' ? '?otevrene=1' : stavFilter ? `?stav=${stavFilter}` : ''
    const res = await fetch(`/api/objednavky${q}`)
    if (res.ok) setRows(await res.json())
  }, [stavFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/api/objednavky/meta').then(r => r.ok ? r.json() : null).then(m => { if (m) setMeta(m) }).catch(() => {})
  }, [])

  const detail = rows?.find(r => r.id === detailId) ?? null
  // detail mimo aktuální filtr (např. z URL) — dotáhnout zvlášť
  const [extra, setExtra] = useState<ObjednavkaDto | null>(null)
  useEffect(() => {
    if (!detailId || detail) { setExtra(null); return }
    fetch(`/api/objednavky/${detailId}`).then(r => r.ok ? r.json() : null).then(setExtra).catch(() => {})
  }, [detailId, detail])
  const shown = detail ?? extra

  function applyChange(o: ObjednavkaDto) {
    setRows(prev => prev ? prev.map(r => r.id === o.id ? o : r) : prev)
    if (extra?.id === o.id) setExtra(o)
  }

  const q = search.toLowerCase()
  const filtered = (rows ?? []).filter(o => !q || `${o.cislo} ${o.dodavatel.nazev} ${o.zakazka?.cislo ?? ''} ${o.zakazka?.nazev ?? ''}`.toLowerCase().includes(q))

  return (
    <>
      <div className="flex items-center gap-3">
        <FilterDropdown
          value={stavFilter}
          onChange={setStavFilter}
          options={[
            { value: 'otevrene', label: 'Otevřené' },
            { value: '', label: 'Všechny' },
            ...Object.entries(OBJ_STAV_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
        <p className="text-xs text-gray-400 dark:text-slate-500">Nové objednávky vznikají ze zakázky (Položky → Objednat u dodavatele).</p>
      </div>

      <div className={`grid gap-4 ${shown ? 'xl:grid-cols-[1fr_1.4fr]' : ''}`}>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          {rows === null ? (
            <div className="text-center py-14 text-gray-400 dark:text-slate-500 text-sm">Načítám…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14 text-gray-400 dark:text-slate-500 text-sm">Žádné objednávky</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                    <th className={`text-left ${thCls}`}>Číslo</th>
                    <th className={`text-left ${thCls}`}>Dodavatel</th>
                    <th className={`text-left ${thCls}`}>Zakázka</th>
                    <th className={`text-left ${thCls}`}>Stav</th>
                    <th className={`text-right ${thCls}`}>Položek</th>
                    {showNakupky && <th className={`text-right ${thCls}`}>Celkem</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {filtered.map(o => (
                    <tr key={o.id} onClick={() => setDetailId(o.id === detailId ? null : o.id)} className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30 ${detailId === o.id ? 'bg-green-50/60 dark:bg-green-900/10' : ''}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white">{o.cislo}</span>
                        <p className="text-xs text-gray-400">{formatDate(o.vytvoreno)}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{o.dodavatel.nazev}</td>
                      <td className="px-4 py-3">
                        {o.zakazka ? (
                          <Link href={`/zakazky/${o.zakazka.id}?tab=objednavky`} onClick={e => e.stopPropagation()} className="text-green-600 dark:text-green-400 font-mono text-xs hover:underline">{o.zakazka.cislo}</Link>
                        ) : <span className="text-gray-400">—</span>}
                        {o.zakazka && <p className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-[180px]">{o.zakazka.nazev}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${OBJ_STAV_COLORS[o.stav]}`}>{OBJ_STAV_LABELS[o.stav]}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-slate-400 whitespace-nowrap">{o.pocetDorucenych}/{o.pocetPolozek}</td>
                      {showNakupky && <td className="px-4 py-3 text-right text-gray-900 dark:text-white whitespace-nowrap">{o.celkem !== null ? formatKcPresne(o.celkem) : '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {shown && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 relative">
            <button onClick={() => setDetailId(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-white" title="Zavřít">✕</button>
            <ObjednavkaDetail
              objednavka={shown}
              canEdit={meta.canEdit}
              showNakupky={showNakupky}
              emailConfigured={meta.emailConfigured}
              onChange={applyChange}
              onDeleted={() => { setDetailId(null); load() }}
              compact
            />
          </div>
        )}
      </div>
    </>
  )
}
