'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { SkladPohybTyp } from '@prisma/client'
import { formatDateTime, formatKcPresne, formatCislo } from '@/lib/format'
import FilterDropdown from '@/components/ui/FilterDropdown'
import ProductCatalogModal from '@/components/ProductCatalogModal'
import { toast } from 'sonner'

const TYP_LABELS: Record<SkladPohybTyp, string> = {
  PRIJEM_SKLAD: 'Příjem na sklad',
  REZERVACE: 'Rezervace',
  STORNO_REZERVACE: 'Storno rezervace',
  VYDEJ: 'Výdej',
  VRATKA_VYDEJE: 'Vrátka výdeje',
  KOREKCE: 'Korekce',
  STORNO: 'Storno',
}
const TYP_COLORS: Record<SkladPohybTyp, string> = {
  PRIJEM_SKLAD: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  REZERVACE: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  STORNO_REZERVACE: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  VYDEJ: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  VRATKA_VYDEJE: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  KOREKCE: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  STORNO: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

interface Pohyb {
  id: string
  typ: SkladPohybTyp
  productId: string | null
  nazev: string
  mnozstvi: number
  nakupniCena: number | null
  duvod: string | null
  vytvoreno: string
  zakazka: { id: string; cislo: string; nazev: string; klient: string; technologie: string | null } | null
  vytvoril: { id: string; jmeno: string }
}

interface Zasoba {
  id: string
  kod: string | null
  nazev: string
  jednotka: string
  minMnozstvi: number | null
  nakladovaCena: number | null
  naSklade: number
  rezervovano: number
  dostupne: number
  hodnota: number | null
}

interface Props {
  pohyby: Pohyb[]
  zasoby: Zasoba[]
  zakazky: { id: string; cislo: string; nazev: string }[]
  kpi: { zasobaHodnota: number; rezervaceHodnota: number; vydejMesicHodnota: number; pocetPohybu: number; podMinimem: number }
  /** naskladňovat / korigovat (sklad = PLNY) */
  canPrijem: boolean
  /** nákupní ceny a hodnoty (financeNakupky) */
  showNakupky: boolean
}

const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary'
const lbl = 'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'
const fmtQty = (n: number) => n.toLocaleString('cs-CZ', { maximumFractionDigits: 3 })
const fmtKc = (n: number) => `${n.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč`

type PrijemRow = { productId: string; nazev: string; jednotka: string; mnozstvi: string; nakupniCena: string }

/** Příjem na sklad — výběr z katalogu, pak množství a nákupní cena za řádek. */
function PrijemModal({ showNakupky, onClose, onDone }: { showNakupky: boolean; onClose: () => void; onDone: (p: Pohyb[]) => void }) {
  const [rows, setRows] = useState<PrijemRow[]>([])
  const [showCatalog, setShowCatalog] = useState(true)
  const [poznamka, setPoznamka] = useState('')
  const [loading, setLoading] = useState(false)

  function addFromCatalog(items: { productId: string; nazev: string; mnozstvi: number; jednotka?: string }[]) {
    setRows(prev => {
      const known = new Set(prev.map(r => r.productId))
      return [
        ...prev,
        ...items.filter(i => !known.has(i.productId)).map(i => ({
          productId: i.productId, nazev: i.nazev, jednotka: i.jednotka ?? 'ks', mnozstvi: String(i.mnozstvi || 1), nakupniCena: '',
        })),
      ]
    })
    setShowCatalog(false)
  }

  function setRow(i: number, patch: Partial<PrijemRow>) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const created: Pohyb[] = []
    try {
      for (const r of rows) {
        const res = await fetch('/api/sklad/prijem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: r.productId,
            mnozstvi: Number(r.mnozstvi),
            nakupniCena: r.nakupniCena === '' ? null : Number(r.nakupniCena),
            poznamka,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error(err.error ?? `Příjem položky ${r.nazev} selhal`)
          break
        }
        const p = await res.json()
        created.push({
          ...p,
          mnozstvi: Number(p.mnozstvi),
          nakupniCena: p.nakupniCena !== null ? Number(p.nakupniCena) : null,
          zakazka: null,
        })
      }
      if (created.length) {
        toast.success(`Naskladněno ${created.length} ${created.length === 1 ? 'položka' : created.length < 5 ? 'položky' : 'položek'}`)
        onDone(created)
        onClose()
      }
    } finally { setLoading(false) }
  }

  if (showCatalog) {
    return (
      <ProductCatalogModal
        onClose={() => rows.length ? setShowCatalog(false) : onClose()}
        onAdd={addFromCatalog}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Příjem na sklad</h2>
          <button type="button" onClick={() => setShowCatalog(true)} className="text-sm text-green-600 dark:text-green-400 hover:underline">+ Přidat z katalogu</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-slate-400 uppercase">
                <th className="text-left py-1">Produkt</th>
                <th className="text-right py-1 w-28">Množství</th>
                {showNakupky && <th className="text-right py-1 w-32">Nák. cena / MJ</th>}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.productId}>
                  <td className="py-1 pr-2 text-gray-900 dark:text-white">{r.nazev}</td>
                  <td className="py-1">
                    <div className="flex items-center gap-1">
                      <input type="number" value={r.mnozstvi} onChange={e => setRow(i, { mnozstvi: e.target.value })} min="0.001" step="any" required className={`${inp} text-right`} />
                      <span className="text-xs text-gray-400">{r.jednotka}</span>
                    </div>
                  </td>
                  {showNakupky && (
                    <td className="py-1 pl-2">
                      <input type="number" value={r.nakupniCena} onChange={e => setRow(i, { nakupniCena: e.target.value })} min="0" step="0.01" placeholder="z katalogu" className={`${inp} text-right`} />
                    </td>
                  )}
                  <td className="py-1 text-right">
                    <button type="button" onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500" title="Odebrat">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <label className={lbl}>Poznámka (dodavatel, číslo dodacího listu…)</label>
            <input type="text" value={poznamka} onChange={e => setPoznamka(e.target.value)} className={inp} />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">Zrušit</button>
            <button type="submit" disabled={loading || rows.length === 0} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
              {loading ? 'Ukládám…' : 'Naskladnit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/** Ruční korekce zůstatku (inventura). */
function KorekceModal({ zasoba, onClose, onDone }: { zasoba: Zasoba; onClose: () => void; onDone: (p: Pohyb, stav: { naSklade: number; rezervovano: number; dostupne: number }) => void }) {
  const [mnozstvi, setMnozstvi] = useState('')
  const [duvod, setDuvod] = useState('')
  const [loading, setLoading] = useState(false)
  const delta = Number(mnozstvi || 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/sklad/korekce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: zasoba.id, mnozstvi: delta, duvod }),
      })
      const p = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(p.error ?? 'Korekce selhala'); return }
      onDone({ ...p, mnozstvi: Number(p.mnozstvi), nakupniCena: p.nakupniCena !== null ? Number(p.nakupniCena) : null, zakazka: null }, p.stav)
      toast.success('Zůstatek opraven')
      onClose()
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Korekce zůstatku</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{zasoba.kod ? `${zasoba.kod} · ` : ''}{zasoba.nazev}</p>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Na skladě: <strong>{fmtQty(zasoba.naSklade)} {zasoba.jednotka}</strong>
            {delta !== 0 && <> → po korekci <strong>{fmtQty(zasoba.naSklade + delta)} {zasoba.jednotka}</strong></>}
          </p>
          <div>
            <label className={lbl}>Změna množství (+ / −) *</label>
            <input type="number" value={mnozstvi} onChange={e => setMnozstvi(e.target.value)} step="any" required placeholder="např. -2 nebo 5" className={inp} />
          </div>
          <div>
            <label className={lbl}>Důvod *</label>
            <input type="text" value={duvod} onChange={e => setDuvod(e.target.value)} required placeholder="inventura, poškození, chybný příjem…" className={inp} />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">Zrušit</button>
            <button type="submit" disabled={loading || delta === 0 || !duvod.trim()} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
              {loading ? 'Ukládám…' : 'Opravit zůstatek'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const thCls = 'px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide'

export default function SkladPageClient({ pohyby: initialPohyby, zasoby: initialZasoby, zakazky, kpi: initialKpi, canPrijem, showNakupky }: Props) {
  const [tab, setTab] = useState<'zasoby' | 'pohyby'>('zasoby')
  const [pohyby, setPohyby] = useState(initialPohyby)
  const [zasoby, setZasoby] = useState(initialZasoby)
  const [kpi, setKpi] = useState(initialKpi)
  const [search, setSearch] = useState('')
  const [typFilter, setTypFilter] = useState<SkladPohybTyp | ''>('')
  const [zakazkaFilter, setZakazkaFilter] = useState('')
  const [datumOd, setDatumOd] = useState('')
  const [datumDo, setDatumDo] = useState('')
  const [jenPodMinimem, setJenPodMinimem] = useState(false)
  const [showPrijem, setShowPrijem] = useState(false)
  const [korekce, setKorekce] = useState<Zasoba | null>(null)

  const typFilterOptions = [
    { value: '', label: 'Všechny typy' },
    ...(Object.keys(TYP_LABELS) as SkladPohybTyp[]).filter(t => t !== 'STORNO').map(t => ({ value: t, label: TYP_LABELS[t] })),
  ]
  const zakazkaFilterOptions = [
    { value: '', label: 'Všechny zakázky' },
    ...zakazky.map(z => ({ value: z.id, label: `${z.cislo} — ${z.nazev}` })),
  ]

  const filtered = useMemo(() => {
    return pohyby.filter(p => {
      if (typFilter && p.typ !== typFilter) return false
      if (zakazkaFilter && p.zakazka?.id !== zakazkaFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const haystack = [p.nazev, p.zakazka?.cislo, p.zakazka?.klient, p.zakazka?.technologie]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (datumOd && p.vytvoreno < datumOd) return false
      if (datumDo && p.vytvoreno.slice(0, 10) > datumDo) return false
      return true
    })
  }, [pohyby, typFilter, zakazkaFilter, search, datumOd, datumDo])

  const filteredZasoby = useMemo(() => {
    const q = search.toLowerCase()
    return zasoby.filter(z => {
      if (jenPodMinimem && !(z.minMnozstvi !== null && z.dostupne <= z.minMnozstvi)) return false
      if (q && !`${z.kod ?? ''} ${z.nazev}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [zasoby, search, jenPodMinimem])

  /** Po příjmu/korekci: nový pohyb do deníku a přepočet řádku zásob (server vrací stav produktu). */
  function applyPohyb(p: Pohyb, stav?: { naSklade: number; rezervovano: number; dostupne: number }) {
    setPohyby(prev => [p, ...prev])
    setKpi(prev => ({ ...prev, pocetPohybu: prev.pocetPohybu + 1 }))
    if (!p.productId) return
    setZasoby(prev => {
      const idx = prev.findIndex(z => z.id === p.productId)
      const s = stav ?? (p as unknown as { stav?: { naSklade: number; rezervovano: number; dostupne: number } }).stav
      if (idx === -1) {
        const cena = p.nakupniCena
        const naSklade = s?.naSklade ?? p.mnozstvi
        return [...prev, {
          id: p.productId!, kod: null, nazev: p.nazev, jednotka: 'ks', minMnozstvi: null,
          nakladovaCena: showNakupky ? cena : null,
          naSklade, rezervovano: s?.rezervovano ?? 0, dostupne: s?.dostupne ?? naSklade,
          hodnota: showNakupky && cena !== null ? Math.max(naSklade, 0) * cena : null,
        }]
      }
      const z = prev[idx]
      const naSklade = s?.naSklade ?? z.naSklade + p.mnozstvi
      const rezervovano = s?.rezervovano ?? z.rezervovano
      const next: Zasoba = {
        ...z, naSklade, rezervovano, dostupne: s?.dostupne ?? naSklade - rezervovano,
        hodnota: z.nakladovaCena !== null ? Math.max(naSklade, 0) * z.nakladovaCena : null,
      }
      return prev.map((row, i) => i === idx ? next : row)
    })
  }

  // KPI hodnoty zásob se přepočítávají z řádků, ať sedí s tabulkou
  const zasobaHodnota = showNakupky ? zasoby.reduce((s, z) => s + (z.hodnota ?? 0), 0) : 0
  const rezervaceHodnota = showNakupky ? zasoby.reduce((s, z) => s + (z.nakladovaCena !== null ? Math.max(z.rezervovano, 0) * z.nakladovaCena : 0), 0) : 0
  const podMinimem = zasoby.filter(z => z.minMnozstvi !== null && z.dostupne <= z.minMnozstvi).length

  const tabBtn = (key: 'zasoby' | 'pohyby', label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${tab === key ? 'bg-[#1B5E20] text-white' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
    >
      {label}
    </button>
  )

  return (
    <>
      {showPrijem && <PrijemModal showNakupky={showNakupky} onClose={() => setShowPrijem(false)} onDone={ps => ps.forEach(p => applyPohyb(p))} />}
      {korekce && <KorekceModal zasoba={korekce} onClose={() => setKorekce(null)} onDone={applyPohyb} />}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sklad</h1>
          {canPrijem && (
            <button
              onClick={() => setShowPrijem(true)}
              className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Příjem na sklad
            </button>
          )}
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            ...(showNakupky ? [
              { label: 'Hodnota zásoby', value: fmtKc(zasobaHodnota), color: 'text-teal-600 dark:text-teal-400' },
              { label: 'Rezervováno', value: fmtKc(rezervaceHodnota), color: 'text-primary dark:text-primary-light' },
              { label: 'Vydáno tento měsíc', value: fmtKc(kpi.vydejMesicHodnota), color: 'text-orange-600 dark:text-orange-400' },
            ] : [
              { label: 'Produktů na skladě', value: formatCislo(zasoby.length), color: 'text-teal-600 dark:text-teal-400' },
            ]),
            podMinimem > 0
              ? { label: 'Pod minimem', value: formatCislo(podMinimem), color: 'text-red-600 dark:text-red-400' }
              : { label: 'Pohybů celkem', value: formatCislo(kpi.pocetPohybu), color: 'text-gray-900 dark:text-white' },
          ].map(k => (
            <div key={k.label} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-4">
              <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-1">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs + filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-full border border-gray-200 dark:border-slate-700 p-1">
            {tabBtn('zasoby', 'Zásoby')}
            {tabBtn('pohyby', 'Pohyby')}
          </div>
          <div className="relative">
            <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tab === 'zasoby' ? 'Hledat produkt…' : 'Hledat položku, zakázku, klienta…'}
              className="pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {tab === 'zasoby' ? (
            <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400 cursor-pointer">
              <input type="checkbox" checked={jenPodMinimem} onChange={e => setJenPodMinimem(e.target.checked)} className="rounded border-gray-300" />
              Jen pod minimem
            </label>
          ) : (
            <>
              <FilterDropdown value={typFilter} onChange={v => setTypFilter(v as SkladPohybTyp | '')} options={typFilterOptions} />
              <FilterDropdown value={zakazkaFilter} onChange={setZakazkaFilter} options={zakazkaFilterOptions} className="max-w-[200px]" />
              <input type="date" value={datumOd} onChange={e => setDatumOd(e.target.value)} className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" />
              <input type="date" value={datumDo} onChange={e => setDatumDo(e.target.value)} className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" />
            </>
          )}
        </div>

        {tab === 'zasoby' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            {filteredZasoby.length === 0 ? (
              <div className="text-center py-14 text-gray-400 dark:text-slate-500 text-sm">
                {zasoby.length === 0 ? 'Zatím žádná zásoba — začněte příjmem na sklad z katalogu produktů.' : 'Nic neodpovídá filtru'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                      <th className={`text-left ${thCls}`}>Produkt</th>
                      <th className={`text-right ${thCls}`}>Na skladě</th>
                      <th className={`text-right ${thCls}`}>Rezervováno</th>
                      <th className={`text-right ${thCls}`}>Dostupné</th>
                      <th className={`text-right ${thCls}`}>Minimum</th>
                      {showNakupky && <th className={`text-right ${thCls}`}>Hodnota</th>}
                      {canPrijem && <th className={thCls} />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                    {filteredZasoby.map(z => {
                      const podMin = z.minMnozstvi !== null && z.dostupne <= z.minMnozstvi
                      return (
                        <tr key={z.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                          <td className="px-4 py-3 max-w-[320px]">
                            <Link href={`/products/${z.id}`} className="font-medium text-gray-900 dark:text-white hover:underline block truncate">{z.nazev}</Link>
                            {z.kod && <p className="text-xs font-mono text-gray-400 dark:text-slate-500">{z.kod}</p>}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 dark:text-slate-300 whitespace-nowrap">{fmtQty(z.naSklade)} {z.jednotka}</td>
                          <td className="px-4 py-3 text-right text-gray-500 dark:text-slate-400 whitespace-nowrap">{fmtQty(z.rezervovano)}</td>
                          <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${z.dostupne < 0 ? 'text-red-600 dark:text-red-400' : podMin ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                            {fmtQty(z.dostupne)}
                            {z.dostupne < 0 && <span className="ml-1 text-xs font-normal">(chybí {fmtQty(-z.dostupne)})</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-400 dark:text-slate-500 whitespace-nowrap">
                            {z.minMnozstvi !== null ? fmtQty(z.minMnozstvi) : '—'}
                            {podMin && <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-red-500" title="Pod minimem" />}
                          </td>
                          {showNakupky && (
                            <td className="px-4 py-3 text-right text-gray-900 dark:text-white whitespace-nowrap">{z.hodnota !== null ? fmtKc(z.hodnota) : '—'}</td>
                          )}
                          {canPrijem && (
                            <td className="px-4 py-3 text-right">
                              <button type="button" onClick={() => setKorekce(z)} className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">Korekce</button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'pohyby' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-14 text-gray-400 dark:text-slate-500 text-sm">Žádné pohyby</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                    <th className={`text-left ${thCls}`}>Datum</th>
                    <th className={`text-left ${thCls}`}>Typ</th>
                    <th className={`text-left ${thCls}`}>Položka</th>
                    <th className={`text-left ${thCls}`}>Zakázka</th>
                    <th className={`text-right ${thCls}`}>Množství</th>
                    {showNakupky && <th className={`text-right ${thCls}`}>NK. cena</th>}
                    {showNakupky && <th className={`text-right ${thCls}`}>Celkem</th>}
                    <th className={`text-left ${thCls}`}>Kdo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {filtered.map(p => {
                    const celkem = p.nakupniCena !== null ? p.mnozstvi * p.nakupniCena : null
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap text-xs">
                          {formatDateTime(p.vytvoreno)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYP_COLORS[p.typ]}`}>
                            {TYP_LABELS[p.typ]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white font-medium max-w-[200px]">
                          {p.productId
                            ? <Link href={`/products/${p.productId}`} className="truncate block hover:underline">{p.nazev}</Link>
                            : <p className="truncate">{p.nazev}</p>}
                          {p.duvod && <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{p.duvod}</p>}
                        </td>
                        <td className="px-4 py-3 max-w-[240px]">
                          {p.zakazka ? (
                            <>
                              <Link href={`/zakazky/${p.zakazka.id}`} className="text-green-600 dark:text-green-400 font-mono text-xs hover:underline">
                                {p.zakazka.cislo}
                              </Link>
                              {p.zakazka.klient && (
                                <p className="text-xs text-gray-700 dark:text-slate-300 truncate">{p.zakazka.klient}</p>
                              )}
                              {p.zakazka.technologie && (
                                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{p.zakazka.technologie}</p>
                              )}
                            </>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 dark:text-slate-300">{fmtQty(p.mnozstvi)}</td>
                        {showNakupky && (
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-slate-400">
                            {p.nakupniCena !== null ? `${formatKcPresne(p.nakupniCena)}` : '—'}
                          </td>
                        )}
                        {showNakupky && (
                          <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                            {celkem !== null ? fmtKc(Math.abs(celkem)) : '—'}
                          </td>
                        )}
                        <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">{p.vytvoril.jmeno}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}
      </div>
    </>
  )
}
