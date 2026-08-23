'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ZakazkaStav } from '@prisma/client'
import MobileSheet from '@/components/MobileSheet'
import { techLabels, techColors } from '@/lib/constants'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { formatKc } from '@/lib/format'
import FilterDropdown from '@/components/ui/FilterDropdown'
import KeSchvaleniBar, { type KeSchvaleniPolozka } from './KeSchvaleniBar'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ZakazkaRow {
  id: string
  cislo: string
  nazev: string
  stav: ZakazkaStav
  technologie: string | null
  klientId: string
  klientJmeno: string
  vedouciId: string | null
  vedouciJmeno: string | null
  technici: { id: string; jmeno: string }[]
  pocetPolozek: number
  pocetPredavaku: number
  vytvoreno: string
  montazOd: string | null
  montazDo: string | null
  updatedAt: string
  cenaOP: number | null
  cenaVyuctovani: number
  aktualniFaze: string | null
}

interface Props {
  zakazky: ZakazkaRow[]
  vedouci: { id: string; jmeno: string }[]
  role: string
  keSchvaleni?: KeSchvaleniPolozka[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STAV_LABELS: Record<ZakazkaStav, string> = {
  NOVA: 'Nová',
  PRIRAZENA: 'Přiřazena',
  V_REALIZACI: 'V realizaci',
  PREDANA: 'Předána',
  VYUCTOVANA: 'Vyúčtována',
  HOTOVO: 'Hotovo',
}

const STAV_COLORS: Record<ZakazkaStav, string> = {
  NOVA: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  PRIRAZENA: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  V_REALIZACI: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  PREDANA: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  VYUCTOVANA: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  HOTOVO: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

const STAV_NEXT: Partial<Record<ZakazkaStav, ZakazkaStav>> = {
  NOVA: 'PRIRAZENA',
  PRIRAZENA: 'V_REALIZACI',
  V_REALIZACI: 'PREDANA',
  PREDANA: 'VYUCTOVANA',
  VYUCTOVANA: 'HOTOVO',
}

const KANBAN_STEPS = Object.entries(STAV_LABELS) as [ZakazkaStav, string][]

// Aktivní vs. hotové — vyúčtováno ještě neznamená hotovo, opravdu hotová je
// zakázka až po ručním přepnutí do stavu HOTOVO (VYUCTOVANA → HOTOVO).
const AKTIVNI_STAVY: ZakazkaStav[] = ['NOVA', 'PRIRAZENA', 'V_REALIZACI', 'PREDANA', 'VYUCTOVANA']
const HOTOVE_STAVY: ZakazkaStav[] = ['HOTOVO']

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtKc = formatKc

function formatMontaz(od: string | null, doo: string | null): string {
  if (!od) return ''
  const odDate = new Date(od)
  const odStr = odDate.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })
  if (!doo) return odStr
  const doDate = new Date(doo)
  if (odDate.toDateString() === doDate.toDateString()) return odStr
  return `${odStr} – ${doDate.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}`
}

type Urgency = 'red' | 'orange' | 'gray' | null

function getUrgency(z: ZakazkaRow): Urgency {
  if (['HOTOVO', 'VYUCTOVANA', 'PREDANA'].includes(z.stav)) return null
  const now = Date.now()
  if (z.montazOd) {
    const hoursUntil = (new Date(z.montazOd).getTime() - now) / 3_600_000
    if (hoursUntil < 24) return 'red'
    if (hoursUntil < 72) return 'orange'
  }
  const daysSinceUpdate = (now - new Date(z.updatedAt).getTime()) / 86_400_000
  if (daysSinceUpdate > 14) return 'gray'
  return null
}

// ─── Small components ─────────────────────────────────────────────────────────

function UrgencyDot({ urgency }: { urgency: Urgency }) {
  if (!urgency) return null
  const cls = urgency === 'red' ? 'bg-red-500' : urgency === 'orange' ? 'bg-orange-400' : 'bg-gray-400 opacity-60'
  const title = urgency === 'red' ? 'Montáž dnes nebo v prodlení' : urgency === 'orange' ? 'Montáž do 72 h' : 'Žádný pohyb 14+ dní'
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cls}`} title={title} />
}

function StavBadge({ stav }: { stav: ZakazkaStav }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STAV_COLORS[stav]}`}>
      {STAV_LABELS[stav]}
    </span>
  )
}

function TechniciAvatars({ technici }: { technici: { id: string; jmeno: string }[] }) {
  const shown = technici.slice(0, 3)
  const rest = technici.length - 3
  return (
    <div className="flex -space-x-1.5">
      {shown.map(t => (
        <div key={t.id} title={t.jmeno}
          className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white dark:border-slate-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
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

// ─── Mobile card ─────────────────────────────────────────────────────────────

function ZakazkaCard({ z }: { z: ZakazkaRow }) {
  const urgency = getUrgency(z)
  return (
    <Link href={`/zakazky/${z.id}`}
      className="block bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:border-primary-light dark:hover:border-primary-dark transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5">
          <UrgencyDot urgency={urgency} />
          <span className="font-mono text-sm font-bold text-green-600 dark:text-green-400">{z.cislo}</span>
        </div>
        <StavBadge stav={z.stav} />
      </div>
      <p className="text-gray-500 dark:text-slate-400 text-xs mb-0.5 truncate">{z.klientJmeno}</p>
      <p className="font-medium text-gray-900 dark:text-white text-sm truncate mb-2">{z.nazev}</p>
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
        {z.montazOd && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatMontaz(z.montazOd, z.montazDo)}
          </span>
        )}
        {z.vedouciJmeno && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {z.vedouciJmeno}
          </span>
        )}
      </div>
    </Link>
  )
}

// ─── Kanban card ─────────────────────────────────────────────────────────────

function KanbanCard({ z, canCreate, inlineLoadingId, onStavChange }: {
  z: ZakazkaRow
  canCreate: boolean
  inlineLoadingId: string | null
  onStavChange: (id: string, stav: ZakazkaStav) => void
}) {
  const urgency = getUrgency(z)
  const nextStav = STAV_NEXT[z.stav]
  const loading = inlineLoadingId === z.id

  return (
    <Link href={`/zakazky/${z.id}`}
      className="block bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-3 hover:border-primary-light dark:hover:border-primary-dark transition-colors">
      <div className="flex items-center gap-1.5 mb-1">
        <UrgencyDot urgency={urgency} />
        <span className="font-mono text-xs font-bold text-green-600 dark:text-green-400 truncate">{z.cislo}</span>
        {z.technologie && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${techColors[z.technologie as keyof typeof techColors] ?? 'bg-gray-100 text-gray-600'}`}>
            {techLabels[z.technologie as keyof typeof techLabels] ?? z.technologie}
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug line-clamp-2 mb-0.5">{z.nazev}</p>
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-2 truncate">{z.klientJmeno}</p>
      {z.montazOd && (
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-2 flex items-center gap-1">
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {formatMontaz(z.montazOd, z.montazDo)}
        </p>
      )}
      <div className="flex items-center justify-between gap-1">
        <TechniciAvatars technici={z.technici} />
        {canCreate && nextStav && (
          <button
            onClick={e => { e.preventDefault(); onStavChange(z.id, nextStav) }}
            disabled={loading}
            className="text-[10px] px-1.5 py-0.5 bg-gray-50 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary-light border border-gray-200 dark:border-slate-600 rounded transition-colors whitespace-nowrap flex-shrink-0"
          >
            {loading ? '…' : `→ ${STAV_LABELS[nextStav]}`}
          </button>
        )}
      </div>
    </Link>
  )
}

// ─── Kanban view ─────────────────────────────────────────────────────────────

function KanbanView({ zakazky, canCreate, inlineLoadingId, onStavChange }: {
  zakazky: ZakazkaRow[]
  canCreate: boolean
  inlineLoadingId: string | null
  onStavChange: (id: string, stav: ZakazkaStav) => void
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1" style={{ minHeight: '50vh' }}>
      {KANBAN_STEPS.map(([stav, label]) => {
        const cards = zakazky.filter(z => z.stav === stav)
        return (
          <div key={stav} className="flex-shrink-0 w-52">
            <div className={`flex items-center gap-2 px-2.5 py-2 mb-2 rounded-lg ${STAV_COLORS[stav]}`}>
              <span className="text-xs font-semibold">{label}</span>
              <span className="ml-auto text-xs font-bold opacity-70">{cards.length}</span>
            </div>
            <div className="space-y-2">
              {cards.map(z => (
                <KanbanCard key={z.id} z={z} canCreate={canCreate} inlineLoadingId={inlineLoadingId} onStavChange={onStavChange} />
              ))}
              {cards.length === 0 && (
                <div className="text-center py-8 text-xs text-gray-400 dark:text-slate-600 border-2 border-dashed border-gray-100 dark:border-slate-700 rounded-lg">
                  Prázdné
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── New zakázka modal ────────────────────────────────────────────────────────

function NovaZakazkaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [klientQuery, setKlientQuery] = useState('')
  const [klienti, setKlienti] = useState<{ id: string; jmeno: string; prijmeni: string }[]>([])
  const [klientId, setKlientId] = useState('')
  const [nazev, setNazev] = useState('')
  const [technologie, setTechnologie] = useState('')
  const [mistoStavby, setMistoStavby] = useState('')

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
        body: JSON.stringify({ klientId, nazev, technologie: technologie || null, mistoStavby: mistoStavby || null }),
      })
      if (res.ok) {
        const z = await res.json()
        router.push(`/zakazky/${z.id}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const techOptions = [
    { value: 'KLIMA', label: 'Klimatizace' },
    { value: 'TEPELNE_CERPADLO', label: 'Tepelné čerpadlo' },
    { value: 'REKUPERACE', label: 'Rekuperace' },
    { value: 'PODLAHOVE_TOPENI', label: 'Podlahové topení' },
    { value: 'VZDUCHOTECHNIKA', label: 'Vzduchotechnika' },
    { value: 'JINE', label: 'Jiné' },
  ]

  const inputCls = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <MobileSheet open={open} onClose={onClose} title="Nová zakázka">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Klient *</label>
          <input type="text" value={klientQuery}
            onChange={e => { setKlientQuery(e.target.value); setKlientId(''); searchKlienti(e.target.value) }}
            placeholder="Hledat klienta…" className={inputCls} />
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
          <input type="text" value={nazev} onChange={e => setNazev(e.target.value)}
            placeholder="Např. VZT výrobní hala" required className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Technologie</label>
          <select value={technologie} onChange={e => setTechnologie(e.target.value)} className={inputCls}>
            <option value="">— vyberte —</option>
            {techOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Místo stavby</label>
          <input type="text" value={mistoStavby} onChange={e => setMistoStavby(e.target.value)}
            placeholder="Např. Brno, Průmyslová 12" className={inputCls} />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
            Zrušit
          </button>
          <button type="submit" disabled={loading || !klientId || !nazev}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50">
            {loading ? 'Ukládám…' : 'Vytvořit zakázku'}
          </button>
        </div>
      </form>
    </MobileSheet>
  )
}

function tableColSpan(canCreate: boolean, isTechnik: boolean): number {
  // checkbox + Číslo/Klient/Název/Stav/Aktuální fáze/Typ/Technici/Montáž (8) + trailing akce sloupec
  return (canCreate ? 1 : 0) + 8 + 1 + (isTechnik ? 0 : 3)
}

function ZakazkaTableRow({ z, isTechnik, canCreate, isSelected, onToggleSelect, inlineLoadingId, onInlineStavChange }: {
  z: ZakazkaRow
  isTechnik: boolean
  canCreate: boolean
  isSelected: boolean
  onToggleSelect: (checked: boolean) => void
  inlineLoadingId: string | null
  onInlineStavChange: (id: string, stav: ZakazkaStav) => void
}) {
  const urgency = getUrgency(z)
  const nextStav = STAV_NEXT[z.stav]
  return (
    <tr className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
      {canCreate && (
        <td className="px-3 py-3">
          <input type="checkbox" checked={isSelected}
            onChange={e => onToggleSelect(e.target.checked)}
            className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-primary" />
        </td>
      )}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <UrgencyDot urgency={urgency} />
          <Link href={`/zakazky/${z.id}`} className="font-mono text-sm font-bold text-green-600 dark:text-green-400 hover:underline whitespace-nowrap">
            {z.cislo}
          </Link>
        </div>
      </td>
      <td className="px-4 py-3 text-gray-600 dark:text-slate-400 text-sm truncate max-w-[140px]">{z.klientJmeno}</td>
      <td className="px-4 py-3 text-gray-900 dark:text-white font-medium truncate max-w-[200px]">{z.nazev}</td>
      <td className="px-4 py-3"><StavBadge stav={z.stav} /></td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-400 whitespace-nowrap">
        {z.aktualniFaze ?? <span className="text-gray-400 text-xs">—</span>}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {z.technologie ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${techColors[z.technologie as keyof typeof techColors] ?? 'bg-gray-100 text-gray-600'}`}>
            {techLabels[z.technologie as keyof typeof techLabels] ?? z.technologie}
          </span>
        ) : <span className="text-gray-400 text-xs">—</span>}
      </td>
      {!isTechnik && <td className="px-4 py-3 text-gray-600 dark:text-slate-400 text-sm">{z.vedouciJmeno ?? '—'}</td>}
      <td className="px-4 py-3">
        {z.technici.length > 0 ? <TechniciAvatars technici={z.technici} /> : <span className="text-gray-400 text-xs">—</span>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-400 whitespace-nowrap">
        {z.montazOd ? (
          <span className={urgency === 'red' ? 'text-red-600 dark:text-red-400 font-medium' : urgency === 'orange' ? 'text-orange-600 dark:text-orange-400' : ''}>
            {formatMontaz(z.montazOd, z.montazDo)}
          </span>
        ) : <span className="text-gray-300 dark:text-slate-600">—</span>}
      </td>
      {!isTechnik && (
        <td className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-slate-300 whitespace-nowrap">
          {z.cenaOP !== null ? fmtKc(z.cenaOP) : <span className="text-gray-400 dark:text-slate-500">—</span>}
        </td>
      )}
      {!isTechnik && (
        <td className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-slate-300 whitespace-nowrap">
          {z.cenaVyuctovani > 0 ? fmtKc(z.cenaVyuctovani) : <span className="text-gray-400 dark:text-slate-500">—</span>}
        </td>
      )}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 justify-end">
          {canCreate && nextStav && (
            <button
              onClick={() => onInlineStavChange(z.id, nextStav)}
              disabled={inlineLoadingId === z.id}
              className="text-xs px-2 py-1 bg-gray-50 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary-light border border-gray-200 dark:border-slate-600 rounded-md transition-colors whitespace-nowrap disabled:opacity-50"
            >
              {inlineLoadingId === z.id ? '…' : `→ ${STAV_LABELS[nextStav]}`}
            </button>
          )}
          <Link href={`/zakazky/${z.id}`} className="text-primary dark:text-primary-light hover:underline text-sm font-medium whitespace-nowrap">
            Detail →
          </Link>
        </div>
      </td>
    </tr>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ZakazkyPageClient({ zakazky, vedouci, role, keSchvaleni = [] }: Props) {
  const router = useRouter()
  const isTechnik = role === 'TECHNIK'
  const canCreate = role === 'ADMIN'

  // Local copy for optimistic updates
  const [localZakazky, setLocalZakazky] = useState<ZakazkaRow[]>(zakazky)
  useEffect(() => setLocalZakazky(zakazky), [zakazky])

  // View & filter state
  const [view, setView] = useState<'table' | 'kanban'>('table')
  const [search, setSearch] = useState('')
  const [pohled, setPohled] = useState<'aktivni' | 'hotove' | 'vse'>('aktivni')
  const [stavFilter, setStavFilter] = useState<ZakazkaStav | ''>('')
  const [vedouciFilter, setVedouciFilter] = useState('')
  const [montazFilter, setMontazFilter] = useState<'' | 'tento_tyden' | 'pristy_tyden' | 'bez_terminu' | 'po_terminu'>('')
  const [sortByMontaz, setSortByMontaz] = useState<'asc' | 'desc' | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [hotoveExpanded, setHotoveExpanded] = useState(false)

  // Inline stav change
  const [inlineLoadingId, setInlineLoadingId] = useState<string | null>(null)

  // Bulk select (admin only)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkStav, setBulkStav] = useState<ZakazkaStav | ''>('')
  const [bulkLoading, setBulkLoading] = useState(false)

  // Ref for indeterminate state on select-all checkbox
  const selectAllRef = useCallback((el: HTMLInputElement | null) => {
    if (!el) return
    const someSelected = selectedIds.length > 0 && selectedIds.length < localZakazky.length
    el.indeterminate = someSelected
  }, [selectedIds, localZakazky])

  // Inline stav change
  async function handleInlineStavChange(id: string, nextStav: ZakazkaStav) {
    setInlineLoadingId(id)
    setLocalZakazky(prev => prev.map(z => z.id === id ? { ...z, stav: nextStav } : z))
    try {
      const res = await api.patch(`/api/zakazky/${id}/stav`, { stav: nextStav },
        { errorMessage: 'Změnu stavu se nepodařilo uložit.' })
      if (!res.ok) setLocalZakazky(zakazky)
      else router.refresh()
    } finally {
      setInlineLoadingId(null)
    }
  }

  // Bulk stav change
  async function handleBulkStavChange() {
    if (!bulkStav || selectedIds.length === 0) return
    setBulkLoading(true)
    const stav = bulkStav
    setLocalZakazky(prev => prev.map(z => selectedIds.includes(z.id) ? { ...z, stav } : z))
    try {
      const results = await Promise.all(selectedIds.map(id =>
        api.patch(`/api/zakazky/${id}/stav`, { stav }, { silent: true })
      ))
      const failed = results.filter(r => !r.ok).length
      if (failed > 0) {
        setLocalZakazky(zakazky)
        toast.error(`Změnu stavu se nepodařilo uložit u ${failed} z ${selectedIds.length} zakázek.`)
      }
      setSelectedIds([])
      setBulkStav('')
      router.refresh()
    } finally {
      setBulkLoading(false)
    }
  }

  // Filtered + sorted list
  const filtered = useMemo(() => {
    const now = Date.now()
    const dayOfWeek = (new Date().getDay() + 6) % 7
    const thisWeekStart = new Date(); thisWeekStart.setDate(thisWeekStart.getDate() - dayOfWeek); thisWeekStart.setHours(0, 0, 0, 0)
    const thisWeekEnd = new Date(thisWeekStart); thisWeekEnd.setDate(thisWeekStart.getDate() + 6); thisWeekEnd.setHours(23, 59, 59, 999)
    const nextWeekStart = new Date(thisWeekStart); nextWeekStart.setDate(thisWeekStart.getDate() + 7)
    const nextWeekEnd = new Date(thisWeekEnd); nextWeekEnd.setDate(thisWeekEnd.getDate() + 7)

    let result = localZakazky.filter(z => {
      // Pohled Aktivní/Hotové — jen pro tabulku a mobilní seznam; kanban je
      // pipeline všech stavů. Explicitní filtr stavu má přednost.
      if (view !== 'kanban' && !stavFilter) {
        if (pohled === 'aktivni' && !AKTIVNI_STAVY.includes(z.stav)) return false
        if (pohled === 'hotove' && !HOTOVE_STAVY.includes(z.stav)) return false
      }
      if (stavFilter && z.stav !== stavFilter) return false
      if (vedouciFilter && z.vedouciId !== vedouciFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!z.cislo.toLowerCase().includes(q) && !z.nazev.toLowerCase().includes(q) && !z.klientJmeno.toLowerCase().includes(q)) return false
      }
      if (montazFilter === 'bez_terminu' && z.montazOd !== null) return false
      if (montazFilter === 'po_terminu') {
        if (!z.montazOd || new Date(z.montazOd).getTime() >= now) return false
        if (['PREDANA', 'VYUCTOVANA', 'HOTOVO'].includes(z.stav)) return false
      }
      if (montazFilter === 'tento_tyden') {
        if (!z.montazOd) return false
        const t = new Date(z.montazOd).getTime()
        if (t < thisWeekStart.getTime() || t > thisWeekEnd.getTime()) return false
      }
      if (montazFilter === 'pristy_tyden') {
        if (!z.montazOd) return false
        const t = new Date(z.montazOd).getTime()
        if (t < nextWeekStart.getTime() || t > nextWeekEnd.getTime()) return false
      }
      return true
    })

    if (sortByMontaz) {
      result = [...result].sort((a, b) => {
        if (!a.montazOd && !b.montazOd) return 0
        if (!a.montazOd) return 1
        if (!b.montazOd) return -1
        const diff = new Date(a.montazOd).getTime() - new Date(b.montazOd).getTime()
        return sortByMontaz === 'asc' ? diff : -diff
      })
    }

    return result
  }, [localZakazky, search, pohled, view, stavFilter, vedouciFilter, montazFilter, sortByMontaz])

  // Sbalitelná sekce "Hotovo" pod tabulkou — jen v pohledu Aktivní (jinak by
  // duplikovala to, co je vidět v hlavním seznamu). Respektuje hledání a
  // filtr vedoucího; termínové filtry (tento/příští týden, po termínu) se
  // týkají nadcházející práce, na dokončené zakázky nemají smysl.
  const hotoveRows = useMemo(() => {
    if (view !== 'table' || pohled !== 'aktivni' || stavFilter || montazFilter) return []
    return localZakazky.filter(z => {
      if (!HOTOVE_STAVY.includes(z.stav)) return false
      if (vedouciFilter && z.vedouciId !== vedouciFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!z.cislo.toLowerCase().includes(q) && !z.nazev.toLowerCase().includes(q) && !z.klientJmeno.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [localZakazky, view, pohled, stavFilter, vedouciFilter, search, montazFilter])

  const activeCount = localZakazky.filter(z => AKTIVNI_STAVY.includes(z.stav)).length
  const hotoveCount = localZakazky.filter(z => HOTOVE_STAVY.includes(z.stav)).length

  // Active filter chips
  const activeFilters: { key: string; label: string; clear: () => void }[] = []
  if (search) activeFilters.push({ key: 'search', label: `"${search}"`, clear: () => setSearch('') })
  if (stavFilter) activeFilters.push({ key: 'stav', label: STAV_LABELS[stavFilter], clear: () => setStavFilter('') })
  if (vedouciFilter) {
    const v = vedouci.find(x => x.id === vedouciFilter)
    activeFilters.push({ key: 'vedouci', label: v?.jmeno ?? vedouciFilter, clear: () => setVedouciFilter('') })
  }
  if (montazFilter) {
    const montazLabels = { tento_tyden: 'Tento týden', pristy_tyden: 'Příští týden', bez_terminu: 'Bez termínu', po_terminu: 'Po termínu' }
    activeFilters.push({ key: 'montaz', label: montazLabels[montazFilter], clear: () => setMontazFilter('') })
  }

  const selectedSet = new Set(selectedIds)
  const allFilteredSelected = filtered.length > 0 && filtered.every(z => selectedSet.has(z.id))

  const stavOptions = [
    { value: '', label: 'Všechny stavy' },
    ...(Object.entries(STAV_LABELS) as [ZakazkaStav, string][]).map(([k, v]) => ({
      value: k,
      label: `${v} (${localZakazky.filter(z => z.stav === k).length})`,
    })),
  ]
  const vedouciOptions = [
    { value: '', label: 'Všichni vedoucí' },
    ...vedouci.map(v => ({ value: v.id, label: v.jmeno })),
  ]
  const montazOptions = [
    { value: '', label: 'Montáž — vše' },
    { value: 'tento_tyden', label: 'Tento týden' },
    { value: 'pristy_tyden', label: 'Příští týden' },
    { value: 'po_terminu', label: 'Po termínu' },
    { value: 'bez_terminu', label: 'Bez termínu' },
  ]

  return (
    <>
      <NovaZakazkaModal open={showModal} onClose={() => setShowModal(false)} />

      {/* FAB — mobile only */}
      {canCreate && (
        <button onClick={() => setShowModal(true)}
          className="fab-bottom fixed right-4 z-40 w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg flex items-center justify-center md:hidden transition-colors"
          aria-label="Nová zakázka">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isTechnik ? 'Moje zakázky' : 'Zakázky'}
            </h1>
            {activeCount > 0 && (
              <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                {activeCount} aktivní
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle — desktop only */}
            <div className="hidden md:flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
              <button onClick={() => setView('table')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'table' ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h18M3 18h18" /></svg>
                  Tabulka
                </span>
              </button>
              <button onClick={() => setView('kanban')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'kanban' ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
                  Kanban
                </span>
              </button>
            </div>
            {canCreate && (
              <button onClick={() => setShowModal(true)}
                className="hidden sm:flex bg-primary hover:bg-primary-hover text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nová zakázka
              </button>
            )}
          </div>
        </div>

        {!isTechnik && <KeSchvaleniBar polozky={keSchvaleni} />}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          {view !== 'kanban' && (
            <div className="flex gap-2">
              {([['aktivni', 'Aktivní', activeCount], ['hotove', 'Hotové', hotoveCount], ['vse', 'Vše', null]] as const).map(([key, label, count]) => (
                <button
                  key={key}
                  onClick={() => { setPohled(key); setStavFilter('') }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pohled === key && !stavFilter
                      ? 'bg-green-600 text-white'
                      : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {label}
                  {count !== null && (
                    <span className={`ml-1.5 text-xs font-semibold ${pohled === key && !stavFilter ? 'text-green-100' : 'text-gray-400 dark:text-slate-500'}`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          <div className="relative flex-1 min-w-48 max-w-xs">
            <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Hledat zakázku…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <FilterDropdown value={stavFilter} onChange={v => setStavFilter(v as ZakazkaStav | '')} options={stavOptions} />
          {!isTechnik && vedouci.length > 0 && (
            <FilterDropdown value={vedouciFilter} onChange={setVedouciFilter} options={vedouciOptions} />
          )}
          <FilterDropdown value={montazFilter} onChange={v => setMontazFilter(v as typeof montazFilter)} options={montazOptions} />
        </div>

        {/* Filter chips + count */}
        {(activeFilters.length > 0 || filtered.length !== localZakazky.length) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">{filtered.length} zakázek</span>
            {activeFilters.map(f => (
              <span key={f.key} className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded-full border border-blue-200 dark:border-blue-800">
                {f.label}
                <button onClick={f.clear} className="hover:text-blue-900 dark:hover:text-blue-100 ml-0.5 leading-none">×</button>
              </span>
            ))}
            {activeFilters.length > 1 && (
              <button onClick={() => { setSearch(''); setStavFilter(''); setVedouciFilter(''); setMontazFilter('') }}
                className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 underline">
                Zrušit vše
              </button>
            )}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">Žádné zakázky nebyly nalezeny</p>
          </div>
        ) : (
          <>
            {/* Desktop: table or kanban */}
            {view === 'kanban' ? (
              <div className="hidden md:block">
                <KanbanView zakazky={filtered} canCreate={canCreate} inlineLoadingId={inlineLoadingId} onStavChange={handleInlineStavChange} />
              </div>
            ) : (
              <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                      {canCreate && (
                        <th className="px-3 py-3 w-8">
                          <input type="checkbox" ref={selectAllRef}
                            checked={allFilteredSelected}
                            onChange={e => {
                              if (e.target.checked) setSelectedIds(filtered.map(z => z.id))
                              else setSelectedIds([])
                            }}
                            className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-primary" />
                        </th>
                      )}
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Číslo</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Klient</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Název</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Stav</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Aktuální fáze</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Typ</th>
                      {!isTechnik && <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Vedoucí</th>}
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Technici</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide whitespace-nowrap">
                        <button onClick={() => setSortByMontaz(s => s === 'asc' ? 'desc' : s === 'desc' ? null : 'asc')}
                          className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-slate-200 transition-colors group">
                          Montáž
                          <span className={`transition-colors ${sortByMontaz ? 'text-blue-500' : 'text-gray-300 dark:text-slate-600 group-hover:text-gray-400'}`}>
                            {sortByMontaz === 'asc' ? '↑' : sortByMontaz === 'desc' ? '↓' : '↕'}
                          </span>
                        </button>
                      </th>
                      {!isTechnik && <th className="text-right px-4 py-3 font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Cena dle OP</th>}
                      {!isTechnik && <th className="text-right px-4 py-3 font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Vyúčtováno</th>}
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {filtered.map(z => (
                      <ZakazkaTableRow
                        key={z.id}
                        z={z}
                        isTechnik={isTechnik}
                        canCreate={canCreate}
                        isSelected={selectedSet.has(z.id)}
                        onToggleSelect={checked => {
                          if (checked) setSelectedIds(prev => [...prev, z.id])
                          else setSelectedIds(prev => prev.filter(id => id !== z.id))
                        }}
                        inlineLoadingId={inlineLoadingId}
                        onInlineStavChange={handleInlineStavChange}
                      />
                    ))}
                  </tbody>
                  {hotoveRows.length > 0 && (
                    <tbody>
                      <tr className="border-t border-gray-200 dark:border-slate-700">
                        <td colSpan={tableColSpan(canCreate, isTechnik)} className="px-4 py-0">
                          <button
                            onClick={() => setHotoveExpanded(v => !v)}
                            className="w-full flex items-center gap-2 py-2.5 text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
                          >
                            <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${hotoveExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            Hotovo ({hotoveRows.length})
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  )}
                  {hotoveExpanded && hotoveRows.length > 0 && (
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                      {hotoveRows.map(z => (
                        <ZakazkaTableRow
                          key={z.id}
                          z={z}
                          isTechnik={isTechnik}
                          canCreate={canCreate}
                          isSelected={selectedSet.has(z.id)}
                          onToggleSelect={checked => {
                            if (checked) setSelectedIds(prev => [...prev, z.id])
                            else setSelectedIds(prev => prev.filter(id => id !== z.id))
                          }}
                          inlineLoadingId={inlineLoadingId}
                          onInlineStavChange={handleInlineStavChange}
                        />
                      ))}
                    </tbody>
                  )}
                </table>
              </div>
            )}

            {/* Mobile cards — always shown on mobile regardless of view */}
            <div className="md:hidden space-y-3">
              {filtered.map(z => <ZakazkaCard key={z.id} z={z} />)}
            </div>
          </>
        )}
      </div>

      {/* Bulk action bar */}
      {canCreate && selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 px-4 py-3 flex flex-wrap items-center gap-3 shadow-xl">
          <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">
            ✓ {selectedIds.length} {selectedIds.length === 1 ? 'zakázka' : selectedIds.length < 5 ? 'zakázky' : 'zakázek'}
          </span>
          <div className="flex items-center gap-2">
            <select value={bulkStav} onChange={e => setBulkStav(e.target.value as ZakazkaStav | '')}
              className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Změnit stav…</option>
              {(Object.entries(STAV_LABELS) as [ZakazkaStav, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {bulkStav && (
              <button onClick={handleBulkStavChange} disabled={bulkLoading}
                className="px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50 transition-colors">
                {bulkLoading ? 'Ukládám…' : 'Použít'}
              </button>
            )}
          </div>
          <button onClick={() => { setSelectedIds([]); setBulkStav('') }}
            className="ml-auto text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors">
            Odznačit vše
          </button>
        </div>
      )}
    </>
  )
}
