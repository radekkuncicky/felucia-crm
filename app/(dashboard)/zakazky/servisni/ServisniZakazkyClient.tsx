'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ZakazkaStav } from '@prisma/client'
import MobileSheet from '@/components/MobileSheet'

const STAV_LABELS: Record<ZakazkaStav, string> = {
  NOVA: 'Nová', PRIRAZENA: 'Přiřazena', V_REALIZACI: 'V realizaci',
  PREDANA: 'Předána', VYUCTOVANA: 'Vyúčtována', HOTOVO: 'Hotovo',
}
const STAV_COLORS: Record<ZakazkaStav, string> = {
  NOVA: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  PRIRAZENA: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  V_REALIZACI: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  PREDANA: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  VYUCTOVANA: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  HOTOVO: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

interface ZakazkaRow {
  id: string; cislo: string; nazev: string; stav: ZakazkaStav; technologie: string | null
  klientId: string; klientJmeno: string; vedouciId: string | null; vedouciJmeno: string | null
  technici: { id: string; jmeno: string }[]; pocetPolozek: number; pocetPredavaku: number
  vytvoreno: string; cenaVyuctovani: number
}

interface Props {
  zakazky: ZakazkaRow[]
  vedouci: { id: string; jmeno: string }[]
  role: string
}

const fmtKc = (n: number) => n.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' Kč'

function StavBadge({ stav }: { stav: ZakazkaStav }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STAV_COLORS[stav]}`}>
      {STAV_LABELS[stav]}
    </span>
  )
}

function TechniciAvatars({ technici }: { technici: { id: string; jmeno: string }[] }) {
  const max = 3
  const shown = technici.slice(0, max)
  const rest = technici.length - max
  return (
    <div className="flex -space-x-1.5">
      {shown.map(t => (
        <div key={t.id} title={t.jmeno}
          className="w-6 h-6 rounded-full bg-orange-500 border-2 border-white dark:border-slate-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {t.jmeno.charAt(0).toUpperCase()}
        </div>
      ))}
      {rest > 0 && (
        <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-slate-600 border-2 border-white dark:border-slate-800 flex items-center justify-center text-gray-700 dark:text-slate-300 text-xs font-bold">
          +{rest}
        </div>
      )}
    </div>
  )
}

function ZakazkaCard({ z }: { z: ZakazkaRow }) {
  return (
    <Link href={`/zakazky/${z.id}`} className="block bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:border-orange-300 dark:hover:border-orange-600 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400">{z.cislo}</span>
        <StavBadge stav={z.stav} />
      </div>
      <p className="text-gray-500 dark:text-slate-400 text-xs mb-1 truncate">{z.klientJmeno}</p>
      <p className="font-medium text-gray-900 dark:text-white text-sm truncate mb-3">{z.nazev}</p>
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
        {z.vedouciJmeno && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {z.vedouciJmeno}
          </span>
        )}
        <span>{new Date(z.vytvoreno).toLocaleDateString('cs-CZ')}</span>
      </div>
    </Link>
  )
}

function NovaServisniZakazkaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [klientQuery, setKlientQuery] = useState('')
  const [klienti, setKlienti] = useState<{ id: string; jmeno: string; prijmeni: string }[]>([])
  const [klientId, setKlientId] = useState('')
  const [nazev, setNazev] = useState('')
  const [technologie, setTechnologie] = useState('')

  async function searchKlienti(q: string) {
    if (q.length < 2) { setKlienti([]); return }
    const res = await fetch(`/api/clients?search=${encodeURIComponent(q)}&limit=10`)
    if (res.ok) {
      const data = await res.json()
      setKlienti(data.clients ?? data)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!klientId || !nazev) return
    setLoading(true)
    try {
      const res = await fetch('/api/zakazky', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ klientId, nazev, technologie: technologie || null, typ: 'SERVISNI' }),
      })
      if (res.ok) {
        const z = await res.json()
        router.push(`/zakazky/${z.id}`)
      }
    } finally { setLoading(false) }
  }

  const techOptions = [
    { value: 'KLIMA', label: 'Klimatizace' }, { value: 'TEPELNE_CERPADLO', label: 'Tepelné čerpadlo' },
    { value: 'REKUPERACE', label: 'Rekuperace' }, { value: 'PODLAHOVE_TOPENI', label: 'Podlahové topení' },
    { value: 'VZDUCHOTECHNIKA', label: 'Vzduchotechnika' }, { value: 'JINE', label: 'Jiné' },
  ]

  return (
    <MobileSheet open={open} onClose={onClose} title="Nová servisní zakázka">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Klient *</label>
          <input type="text" value={klientQuery}
            onChange={e => { setKlientQuery(e.target.value); setKlientId(''); searchKlienti(e.target.value) }}
            placeholder="Hledat klienta…"
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          {klienti.length > 0 && !klientId && (
            <div className="border border-gray-200 dark:border-slate-600 rounded-lg mt-1 bg-white dark:bg-slate-800 shadow-lg max-h-40 overflow-y-auto">
              {klienti.map(k => (
                <button key={k.id} type="button"
                  onClick={() => { setKlientId(k.id); setKlientQuery(`${k.jmeno} ${k.prijmeni}`); setKlienti([]) }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white">
                  {k.jmeno} {k.prijmeni}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Název zakázky *</label>
          <input type="text" value={nazev} onChange={e => setNazev(e.target.value)} placeholder="Např. Servis klimatizace - Novák" required
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Technologie</label>
          <select value={technologie} onChange={e => setTechnologie(e.target.value)}
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
            <option value="">— vyberte —</option>
            {techOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg">Zrušit</button>
          <button type="submit" disabled={loading || !klientId || !nazev}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg disabled:opacity-50">
            {loading ? 'Ukládám…' : 'Vytvořit'}
          </button>
        </div>
      </form>
    </MobileSheet>
  )
}

export default function ServisniZakazkyClient({ zakazky, vedouci, role }: Props) {
  const isTechnik = role === 'TECHNIK'
  const canCreate = role === 'ADMIN'

  const [search, setSearch] = useState('')
  const [stavFilter, setStavFilter] = useState<ZakazkaStav | ''>('')
  const [vedouciFilter, setVedouciFilter] = useState('')
  const [showModal, setShowModal] = useState(false)

  const filtered = useMemo(() => zakazky.filter(z => {
    if (stavFilter && z.stav !== stavFilter) return false
    if (vedouciFilter && z.vedouciId !== vedouciFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!z.cislo.toLowerCase().includes(q) && !z.nazev.toLowerCase().includes(q) && !z.klientJmeno.toLowerCase().includes(q)) return false
    }
    return true
  }), [zakazky, search, stavFilter, vedouciFilter])

  const activeCount = zakazky.filter(z => z.stav !== 'HOTOVO').length

  return (
    <>
      <NovaServisniZakazkaModal open={showModal} onClose={() => setShowModal(false)} />

      {canCreate && (
        <button onClick={() => setShowModal(true)}
          className="fab-bottom fixed right-4 z-40 w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg flex items-center justify-center md:hidden transition-colors"
          aria-label="Nová servisní zakázka" style={{ paddingBottom: 0 }}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Servisní zakázky</h1>
            {activeCount > 0 && (
              <span className="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                {activeCount} aktivní
              </span>
            )}
          </div>
          {canCreate && (
            <button onClick={() => setShowModal(true)}
              className="hidden sm:flex bg-orange-600 hover:bg-orange-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nová servisní zakázka
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat zakázku…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <select value={stavFilter} onChange={e => setStavFilter(e.target.value as ZakazkaStav | '')}
            className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
            <option value="">Všechny stavy</option>
            {(Object.keys(STAV_LABELS) as ZakazkaStav[]).map(s => (
              <option key={s} value={s}>{STAV_LABELS[s]}</option>
            ))}
          </select>
          {!isTechnik && vedouci.length > 0 && (
            <select value={vedouciFilter} onChange={e => setVedouciFilter(e.target.value)}
              className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">Všichni vedoucí</option>
              {vedouci.map(v => <option key={v.id} value={v.id}>{v.jmeno}</option>)}
            </select>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            </svg>
            <p className="text-sm">Žádné servisní zakázky</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase">Číslo</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase">Klient</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase">Název</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase">Stav</th>
                    {!isTechnik && <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase">Vedoucí</th>}
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase">Technici</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase">Cena dle vyúč.</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase">Vytvořeno</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {filtered.map(z => (
                    <tr key={z.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/zakazky/${z.id}`} className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400 hover:underline">{z.cislo}</Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-400 text-sm truncate max-w-[160px]">{z.klientJmeno}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white font-medium truncate max-w-[200px]">{z.nazev}</td>
                      <td className="px-4 py-3"><StavBadge stav={z.stav} /></td>
                      {!isTechnik && <td className="px-4 py-3 text-gray-600 dark:text-slate-400 text-sm">{z.vedouciJmeno ?? '—'}</td>}
                      <td className="px-4 py-3">
                        {z.technici.length > 0 ? <TechniciAvatars technici={z.technici} /> : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-slate-300 whitespace-nowrap">
                        {z.cenaVyuctovani > 0 ? fmtKc(z.cenaVyuctovani) : <span className="text-gray-400 dark:text-slate-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-sm whitespace-nowrap">{new Date(z.vytvoreno).toLocaleDateString('cs-CZ')}</td>
                      <td className="px-4 py-3">
                        <Link href={`/zakazky/${z.id}`} className="text-orange-600 dark:text-orange-400 hover:underline text-sm font-medium whitespace-nowrap">Detail →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3">
              {filtered.map(z => <ZakazkaCard key={z.id} z={z} />)}
            </div>
          </>
        )}
      </div>
    </>
  )
}
