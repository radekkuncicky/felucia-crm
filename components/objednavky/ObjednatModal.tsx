'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { formatKcPresne } from '@/lib/format'

/**
 * „Objednat u dodavatele" — z položek zakázky (výchozí výběr = Čeká) vytvoří
 * N objednávek seskupených po dodavatelích. Dodavatel se předvybírá podle hlavního
 * dodavatele produktu; položky bez vazby jdou do skupiny „Vyberte dodavatele".
 */

interface PripravaPolozka {
  id: string
  productId: string | null
  nazev: string
  kod: string | null
  mnozstvi: number
  jednotka: string
  stav: string
  vOtevreneObjednavce: string[]
  dodavatele: { dodavatelId: string; nazev: string; hlavni: boolean; objednaciKod: string | null; nakupniCena: number | null }[]
}

interface Priprava {
  montazOd: string | null
  dodavatele: { id: string; nazev: string; email: string | null }[]
  polozky: PripravaPolozka[]
}

interface Props {
  zakazkaId: string
  showNakupky: boolean
  onClose: () => void
  onCreated: (pocet: number) => void
}

const inp = 'border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary'
const fmtQty = (n: number) => n.toLocaleString('cs-CZ', { maximumFractionDigits: 3 })

type Row = { vybrano: boolean; dodavatelId: string; mnozstvi: string }

export default function ObjednatModal({ zakazkaId, showNakupky, onClose, onCreated }: Props) {
  const [data, setData] = useState<Priprava | null>(null)
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [termin, setTermin] = useState('')
  const [poznamka, setPoznamka] = useState('')
  const [zobrazitCeny, setZobrazitCeny] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/zakazky/${zakazkaId}/objednavky/priprava`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Nepodařilo se načíst položky')))
      .then((d: Priprava) => {
        setData(d)
        setRows(Object.fromEntries(d.polozky.map(p => [p.id, {
          vybrano: p.stav === 'CEKA' && p.vOtevreneObjednavce.length === 0,
          dodavatelId: p.dodavatele.find(x => x.hlavni)?.dodavatelId ?? p.dodavatele[0]?.dodavatelId ?? '',
          mnozstvi: String(p.mnozstvi),
        }])))
        // Výchozí termín: 3 dny před montáží
        if (d.montazOd) {
          const t = new Date(d.montazOd)
          t.setDate(t.getDate() - 3)
          if (t > new Date()) setTermin(t.toISOString().slice(0, 10))
        }
      })
      .catch(e => toast.error(e.message))
  }, [zakazkaId])

  const setRow = (id: string, patch: Partial<Row>) => setRows(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  const skupiny = useMemo(() => {
    if (!data) return []
    const map = new Map<string, PripravaPolozka[]>()
    for (const p of data.polozky) {
      const r = rows[p.id]
      if (!r?.vybrano) continue
      const key = r.dodavatelId || ''
      map.set(key, [...(map.get(key) ?? []), p])
    }
    return Array.from(map.entries())
      .map(([dodavatelId, polozky]) => ({ dodavatelId, nazev: data.dodavatele.find(d => d.id === dodavatelId)?.nazev ?? null, polozky }))
      .sort((a, b) => (a.dodavatelId === '' ? 1 : 0) - (b.dodavatelId === '' ? 1 : 0))
  }, [data, rows])

  const bezDodavatele = skupiny.find(s => s.dodavatelId === '')
  const vybranoCelkem = skupiny.reduce((n, s) => n + s.polozky.length, 0)

  async function submit() {
    if (!data || vybranoCelkem === 0) return
    if (bezDodavatele) { toast.error('U některých položek chybí dodavatel'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/zakazky/${zakazkaId}/objednavky`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skupiny: skupiny.map(s => ({
            dodavatelId: s.dodavatelId,
            pozadovanyTermin: termin || null,
            poznamka: poznamka || null,
            zobrazitCeny,
            polozky: s.polozky.map(p => ({ zakazkaPolozkaId: p.id, mnozstvi: Number(rows[p.id].mnozstvi) })),
          })),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(body.error ?? 'Objednávky se nepodařilo vytvořit'); return }
      toast.success(`Vytvořeno ${body.length} ${body.length === 1 ? 'objednávka' : body.length < 5 ? 'objednávky' : 'objednávek'}`)
      onCreated(body.length)
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Objednat u dodavatele</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Vyberte položky a dodavatele — na každého dodavatele vznikne samostatná objednávka. Položky přejdou do stavu Objednáno.</p>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">
          {!data ? (
            <p className="text-sm text-gray-400">Načítám…</p>
          ) : data.dodavatele.length === 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
              Zatím nemáte žádného dodavatele. Založte ho na <a href="/sklad?tab=dodavatele" className="underline">Sklad → Dodavatelé</a> a přiřaďte k produktům v katalogu.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 dark:text-slate-400 uppercase">
                  <th className="w-8 py-1" />
                  <th className="text-left py-1">Položka</th>
                  <th className="text-left py-1 w-24">Stav</th>
                  <th className="text-right py-1 w-28">Množství</th>
                  <th className="text-left py-1 w-56">Dodavatel</th>
                  {showNakupky && <th className="text-right py-1 w-24">Nák. cena</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {data.polozky.map(p => {
                  const r = rows[p.id]
                  if (!r) return null
                  const vazba = p.dodavatele.find(d => d.dodavatelId === r.dodavatelId)
                  const disabled = p.stav === 'VYDANO' || p.stav === 'NASKLADNENO'
                  return (
                    <tr key={p.id} className={r.vybrano ? '' : 'opacity-60'}>
                      <td className="py-2">
                        <input type="checkbox" checked={r.vybrano} disabled={disabled} onChange={e => setRow(p.id, { vybrano: e.target.checked })} className="rounded border-gray-300" />
                      </td>
                      <td className="py-2 pr-2">
                        <p className="text-gray-900 dark:text-white">{p.nazev}</p>
                        <p className="text-xs text-gray-400 font-mono">
                          {vazba?.objednaciKod ? `obj. ${vazba.objednaciKod}` : p.kod ?? ''}
                          {!p.productId && <span className="ml-1 text-amber-600 dark:text-amber-400 font-sans">bez vazby na katalog</span>}
                          {p.vOtevreneObjednavce.length > 0 && <span className="ml-1 text-blue-600 dark:text-blue-400 font-sans">už v {p.vOtevreneObjednavce.join(', ')}</span>}
                        </p>
                      </td>
                      <td className="py-2 text-xs text-gray-500 dark:text-slate-400">{{ CEKA: 'Čeká', OBJEDNANO: 'Objednáno', NASKLADNENO: 'Rezervováno', VYDANO: 'Vydáno' }[p.stav] ?? p.stav}</td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input type="number" min="0.001" step="any" value={r.mnozstvi} disabled={!r.vybrano} onChange={e => setRow(p.id, { mnozstvi: e.target.value })} className={`${inp} w-20 text-right`} />
                          <span className="text-xs text-gray-400 w-8">{p.jednotka}</span>
                        </div>
                      </td>
                      <td className="py-2">
                        <select value={r.dodavatelId} disabled={!r.vybrano} onChange={e => setRow(p.id, { dodavatelId: e.target.value })} className={`${inp} w-full ${!r.dodavatelId && r.vybrano ? 'border-amber-400' : ''}`}>
                          <option value="">— vyberte —</option>
                          {p.dodavatele.map(d => <option key={d.dodavatelId} value={d.dodavatelId}>{d.nazev}{d.hlavni ? ' (hlavní)' : ''}</option>)}
                          {data.dodavatele.filter(d => !p.dodavatele.some(x => x.dodavatelId === d.id)).map(d => <option key={d.id} value={d.id}>{d.nazev}</option>)}
                        </select>
                      </td>
                      {showNakupky && <td className="py-2 text-right text-gray-600 dark:text-slate-400 whitespace-nowrap">{vazba?.nakupniCena !== null && vazba?.nakupniCena !== undefined ? formatKcPresne(vazba.nakupniCena) : '—'}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {data && data.dodavatele.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Požadovaný termín dodání</label>
                <input type="date" value={termin} onChange={e => setTermin(e.target.value)} className={`${inp} w-full`} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Poznámka pro dodavatele</label>
                <input type="text" value={poznamka} onChange={e => setPoznamka(e.target.value)} className={`${inp} w-full`} placeholder="Např. dodat na místo realizace" />
              </div>
              {showNakupky && (
                <label className="sm:col-span-3 inline-flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={zobrazitCeny} onChange={e => setZobrazitCeny(e.target.checked)} className="rounded border-gray-300" />
                  Uvést nákupní ceny v PDF objednávky
                </label>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <p className="text-sm text-gray-600 dark:text-slate-400">
            {vybranoCelkem === 0 ? 'Nic nevybráno' : (
              <>
                Vznikne <strong>{skupiny.filter(s => s.dodavatelId).length}</strong> {skupiny.filter(s => s.dodavatelId).length === 1 ? 'objednávka' : 'objednávek'}
                {skupiny.filter(s => s.dodavatelId).length > 0 && `: ${skupiny.filter(s => s.dodavatelId).map(s => `${s.nazev} (${s.polozky.length})`).join(', ')}`}
                {bezDodavatele && <span className="text-amber-600 dark:text-amber-400"> · {bezDodavatele.polozky.length} bez dodavatele</span>}
              </>
            )}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">Zrušit</button>
            <button type="button" onClick={submit} disabled={saving || vybranoCelkem === 0 || !!bezDodavatele} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
              {saving ? 'Vytvářím…' : `Vytvořit objednávky (${fmtQty(vybranoCelkem)} pol.)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
