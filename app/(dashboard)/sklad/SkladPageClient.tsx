'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { SkladPohybTyp } from '@prisma/client'
import { formatDateTime, formatKcPresne, formatCislo } from '@/lib/format'
import FilterDropdown from '@/components/ui/FilterDropdown'

const TYP_LABELS: Record<SkladPohybTyp, string> = {
  REZERVACE: 'Rezervace',
  VYDEJ: 'Výdej',
  STORNO: 'Storno',
  PRIJEM_SKLAD: 'Příjem sklad',
}
const TYP_COLORS: Record<SkladPohybTyp, string> = {
  REZERVACE: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  VYDEJ: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  STORNO: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  PRIJEM_SKLAD: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
}

interface Pohyb {
  id: string
  typ: SkladPohybTyp
  nazev: string
  mnozstvi: number
  nakupniCena: number | null
  duvod: string | null
  vytvoreno: string
  zakazka: { id: string; cislo: string; nazev: string } | null
  vytvoril: { id: string; jmeno: string }
}

interface Props {
  pohyby: Pohyb[]
  zakazky: { id: string; cislo: string; nazev: string }[]
  kpi: { rezervaceHodnota: number; vydejMesicHodnota: number; pocetPohybu: number }
  /** naskladňovat (sklad = PLNY) */
  canPrijem: boolean
  /** nákupní ceny a hodnoty (financeNakupky) */
  showNakupky: boolean
}

function PrijemModal({ onClose, onDone }: { onClose: () => void; onDone: (p: Pohyb) => void }) {
  const [nazev, setNazev] = useState('')
  const [mnozstvi, setMnozstvi] = useState('1')
  const [nakupniCena, setNakupniCena] = useState('')
  const [poznamka, setPoznamka] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/sklad/prijem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazev, mnozstvi: Number(mnozstvi), nakupniCena: Number(nakupniCena), poznamka }),
      })
      if (res.ok) {
        const p = await res.json()
        onDone({
          ...p,
          mnozstvi: Number(p.mnozstvi),
          nakupniCena: p.nakupniCena !== null ? Number(p.nakupniCena) : null,
          zakazka: null,
        })
        onClose()
      }
    } finally { setLoading(false) }
  }

  const celkem = Number(mnozstvi || 0) * Number(nakupniCena || 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Naskladnit na sklad</h2>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Název položky *</label>
            <input type="text" value={nazev} onChange={e => setNazev(e.target.value)} required className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Množství *</label>
              <input type="number" value={mnozstvi} onChange={e => setMnozstvi(e.target.value)} min="0.01" step="0.01" required className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nák. cena / ks *</label>
              <input type="number" value={nakupniCena} onChange={e => setNakupniCena(e.target.value)} min="0" step="0.01" required className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          {celkem > 0 && (
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Celkem: <strong>{celkem.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč</strong>
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Poznámka</label>
            <input type="text" value={poznamka} onChange={e => setPoznamka(e.target.value)} className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">Zrušit</button>
            <button type="submit" disabled={loading || !nazev.trim() || !nakupniCena} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
              {loading ? 'Ukládám…' : 'Naskladnit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SkladPageClient({ pohyby: initialPohyby, zakazky, kpi: initialKpi, canPrijem, showNakupky }: Props) {
  const [pohyby, setPohyby] = useState(initialPohyby)
  const [kpi, setKpi] = useState(initialKpi)
  const [search, setSearch] = useState('')
  const [typFilter, setTypFilter] = useState<SkladPohybTyp | ''>('')
  const [zakazkaFilter, setZakazkaFilter] = useState('')
  const [datumOd, setDatumOd] = useState('')
  const [datumDo, setDatumDo] = useState('')
  const [showPrijem, setShowPrijem] = useState(false)

  const typFilterOptions = [
    { value: '', label: 'Všechny typy' },
    ...(Object.keys(TYP_LABELS) as SkladPohybTyp[]).map(t => ({ value: t, label: TYP_LABELS[t] })),
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
        if (!p.nazev.toLowerCase().includes(q) && !p.zakazka?.cislo.toLowerCase().includes(q)) return false
      }
      if (datumOd && p.vytvoreno < datumOd) return false
      if (datumDo && p.vytvoreno.slice(0, 10) > datumDo) return false
      return true
    })
  }, [pohyby, typFilter, zakazkaFilter, search, datumOd, datumDo])

  function handleNewPrijem(p: Pohyb) {
    setPohyby(prev => [p, ...prev])
    setKpi(prev => ({ ...prev, pocetPohybu: prev.pocetPohybu + 1 }))
  }

  return (
    <>
      {showPrijem && <PrijemModal onClose={() => setShowPrijem(false)} onDone={handleNewPrijem} />}

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
              Naskladnit na sklad
            </button>
          )}
        </div>

        {/* KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            ...(showNakupky ? [
              { label: 'Hodnota rezervací', value: `${kpi.rezervaceHodnota.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč`, color: 'text-primary dark:text-primary-light' },
              { label: 'Vydáno tento měsíc', value: `${kpi.vydejMesicHodnota.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč`, color: 'text-orange-600 dark:text-orange-400' },
            ] : []),
            { label: 'Pohybů celkem', value: formatCislo(kpi.pocetPohybu), color: 'text-gray-900 dark:text-white' },
          ].map(k => (
            <div key={k.label} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-4">
              <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-1">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Hledat položku…"
              className="pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <FilterDropdown value={typFilter} onChange={v => setTypFilter(v as SkladPohybTyp | '')} options={typFilterOptions} />
          <FilterDropdown value={zakazkaFilter} onChange={setZakazkaFilter} options={zakazkaFilterOptions} className="max-w-[200px]" />
          <input type="date" value={datumOd} onChange={e => setDatumOd(e.target.value)} className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" />
          <input type="date" value={datumDo} onChange={e => setDatumDo(e.target.value)} className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-14 text-gray-400 dark:text-slate-500 text-sm">Žádné pohyby</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Datum</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Typ</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Položka</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Zakázka</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Množství</th>
                    {showNakupky && <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">NK. cena</th>}
                    {showNakupky && <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Celkem</th>}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Kdo</th>
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
                          <p className="truncate">{p.nazev}</p>
                          {p.duvod && <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{p.duvod}</p>}
                        </td>
                        <td className="px-4 py-3">
                          {p.zakazka ? (
                            <Link href={`/zakazky/${p.zakazka.id}`} className="text-green-600 dark:text-green-400 font-mono text-xs hover:underline">
                              {p.zakazka.cislo}
                            </Link>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 dark:text-slate-300">{p.mnozstvi}</td>
                        {showNakupky && (
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-slate-400">
                            {p.nakupniCena !== null ? `${formatKcPresne(p.nakupniCena)}` : '—'}
                          </td>
                        )}
                        {showNakupky && (
                          <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                            {celkem !== null ? `${celkem.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč` : '—'}
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
      </div>
    </>
  )
}
