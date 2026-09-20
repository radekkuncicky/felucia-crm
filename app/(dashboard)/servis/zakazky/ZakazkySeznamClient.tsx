'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import FilterDropdown from '@/components/ui/FilterDropdown'
import {
  SERVIS_STAV_LABELS,
  TYP_LABELS,
  stavLabel,
  stavColor,
  typLabel,
  jeProsla,
  jeUrgentni,
  jeAktualni,
  jeBudouciPlanovana,
  jeReaktivni,
  SERVIS_HORIZONT_DNI,
} from '@/lib/servisStav'

interface Row {
  id: string
  cislo: string | null
  typ: string
  stav: string
  planovanyTermin: string | null
  skutecnyTermin: string | null
  vyfakturovano: boolean
  popis: string | null
  priorita: string
  kontraktId: string | null
  technik: { id: string; jmeno: string } | null
  klientNazev: string | null
  predmet: string | null
}

interface OrgUser {
  id: string
  jmeno: string
}

interface Props {
  zakazky: Row[]
  orgUsers: OrgUser[]
  canCreate: boolean
}

// Pohledy: Aktuální = reálná práce + smluvní návštěvy do horizontu; Plánované
// ze smluv = generované návštěvy za horizontem (seskupené po měsících);
// Hotové = práce skončila (vč. čekání na platbu/uzavření); ZRUSENA jen ve „Vše".
type Pohled = 'aktualni' | 'smlouvy' | 'hotove' | 'vse'
const HOTOVE_STAVY = ['DOKONCENA', 'VYUCTOVANA', 'UZAVRENA']

// Řazení v Aktuální: urgentní → bez termínu (nejnovější nahoře = pořadí ze serveru) → podle termínu.
function porovnejAktualni(a: Row, b: Row): number {
  const ua = jeUrgentni(a.priorita) ? 0 : 1
  const ub = jeUrgentni(b.priorita) ? 0 : 1
  if (ua !== ub) return ua - ub
  if (!a.planovanyTermin && b.planovanyTermin) return -1
  if (a.planovanyTermin && !b.planovanyTermin) return 1
  if (a.planovanyTermin && b.planovanyTermin) return a.planovanyTermin.localeCompare(b.planovanyTermin)
  return 0
}

function mesicKlic(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function mesicLabel(klic: string): string {
  const [y, m] = klic.split('-').map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function ZakazkySeznamClient({ zakazky, orgUsers, canCreate }: Props) {
  const [pohled, setPohled] = useState<Pohled>('aktualni')
  const [fStav, setFStav] = useState<string>('')
  const [fTechnik, setFTechnik] = useState<string>('')
  const [fTyp, setFTyp] = useState<string>('')
  const [hledat, setHledat] = useState('')

  const now = useMemo(() => new Date(), [])

  const counts = useMemo(() => ({
    aktualni: zakazky.filter(z => jeAktualni(z, now)).length,
    smlouvy: zakazky.filter(z => jeBudouciPlanovana(z, now)).length,
    hotove: zakazky.filter(z => HOTOVE_STAVY.includes(z.stav)).length,
  }), [zakazky, now])

  const filtered = useMemo(() => {
    const q = hledat.trim().toLowerCase()
    const rows = zakazky.filter(z => {
      // Explicitní filtr stavu má přednost před pohledem.
      if (fStav) {
        if (z.stav !== fStav) return false
      } else if (pohled === 'aktualni') {
        if (!jeAktualni(z, now)) return false
      } else if (pohled === 'smlouvy') {
        if (!jeBudouciPlanovana(z, now)) return false
      } else if (pohled === 'hotove') {
        if (!HOTOVE_STAVY.includes(z.stav)) return false
      }
      if (fTechnik && z.technik?.id !== fTechnik) return false
      if (fTyp && z.typ !== fTyp) return false
      if (q) {
        const hay = [z.cislo, z.klientNazev, z.popis, z.predmet, z.technik?.jmeno].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    if (pohled === 'aktualni' && !fStav) rows.sort(porovnejAktualni)
    return rows
  }, [zakazky, pohled, fStav, fTechnik, fTyp, hledat, now])

  // Plánované ze smluv seskupené po měsících (ostatní pohledy = jedna skupina bez hlavičky).
  const skupiny = useMemo(() => {
    if (pohled !== 'smlouvy' || fStav) return [{ klic: '', label: null as string | null, rows: filtered as Row[] }]
    const map = new Map<string, Row[]>()
    for (const z of filtered) {
      const k = z.planovanyTermin ? mesicKlic(z.planovanyTermin) : 'bez'
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(z)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([klic, rows]) => ({ klic, label: klic === 'bez' ? 'Bez termínu' : mesicLabel(klic), rows }))
  }, [filtered, pohled, fStav])

  const stavFilterOptions = [
    { value: '', label: 'Stav — podle pohledu' },
    ...Object.entries(SERVIS_STAV_LABELS).map(([k, v]) => ({ value: k, label: v })),
  ]
  const technikFilterOptions = [
    { value: '', label: 'Všichni technici' },
    ...orgUsers.map(u => ({ value: u.id, label: u.jmeno })),
  ]
  const typFilterOptions = [
    { value: '', label: 'Všechny typy' },
    ...Object.entries(TYP_LABELS).map(([k, v]) => ({ value: k, label: v })),
  ]

  return (
    <>
      {/* Filtry + akce */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          {([
            ['aktualni', 'Aktuální', counts.aktualni, `Reaktivní práce + smluvní návštěvy do ${SERVIS_HORIZONT_DNI} dní`],
            ['smlouvy', 'Plánované ze smluv', counts.smlouvy, `Generované návštěvy za horizontem ${SERVIS_HORIZONT_DNI} dní`],
            ['hotove', 'Hotové', counts.hotove, 'Dokončené, vyúčtované a uzavřené'],
            ['vse', 'Vše', null, 'Všechny včetně zrušených'],
          ] as const).map(([key, label, count, title]) => (
            <button
              key={key}
              title={title}
              onClick={() => { setPohled(key); setFStav('') }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                pohled === key && !fStav
                  ? 'bg-green-600 text-white'
                  : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              {label}
              {count !== null && (
                <span className={`ml-1.5 text-xs font-semibold ${pohled === key && !fStav ? 'text-green-100' : 'text-gray-400 dark:text-slate-500'}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={hledat}
          onChange={e => setHledat(e.target.value)}
          placeholder="Hledat číslo, klienta, popis, zařízení…"
          className="w-full sm:w-64 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-400 dark:placeholder-slate-500"
        />
        <FilterDropdown value={fStav} onChange={setFStav} options={stavFilterOptions} />
        <FilterDropdown value={fTechnik} onChange={setFTechnik} options={technikFilterOptions} />
        <FilterDropdown value={fTyp} onChange={setFTyp} options={typFilterOptions} />
        {canCreate && (
          <Link
            href="/servis/nova"
            className="ml-auto px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors"
          >
            + Nová servisní akce
          </Link>
        )}
      </div>

      {/* Seznam */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-12 text-center">
          <p className="text-gray-500 dark:text-slate-400">
            {pohled === 'aktualni' && !fStav && !hledat ? 'Žádná aktuální práce — nic nehoří.' : 'Žádné zakázky odpovídající filtru'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
        {skupiny.map(skupina => (
        <div key={skupina.klic} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          {skupina.label && (
            <div className="px-5 py-2.5 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">{skupina.label}</h3>
              <span className="text-xs text-gray-500 dark:text-slate-400">{skupina.rows.length}</span>
            </div>
          )}
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {skupina.rows.map(z => {
              const prosla = jeProsla(z.stav, z.planovanyTermin)
              return (
                <Link
                  key={z.id}
                  href={`/servis/zakazky/${z.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  {/* Datum */}
                  <div className="flex-shrink-0 w-16 text-center">
                    {z.planovanyTermin ? (
                      <>
                        <p className={`text-lg font-bold leading-none ${prosla ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                          {new Date(z.planovanyTermin).getDate()}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">
                          {new Date(z.planovanyTermin).toLocaleDateString('cs-CZ', { month: 'short' })}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">
                          {new Date(z.planovanyTermin).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-slate-500 italic">bez termínu</span>
                    )}
                  </div>

                  {/* Obsah */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {z.cislo && <span className="text-xs font-mono text-gray-400 dark:text-slate-500">{z.cislo}</span>}
                      <p className="font-medium text-gray-900 dark:text-white truncate">{z.klientNazev ?? '—'}</p>
                      {jeUrgentni(z.priorita) && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Urgentní</span>
                      )}
                    </div>
                    {z.popis && <p className="text-sm text-gray-700 dark:text-slate-300 truncate mt-0.5">{z.popis}</p>}
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {z.predmet && <span className="text-xs text-gray-500 dark:text-slate-400">{z.predmet}</span>}
                      <span className="text-xs text-gray-400 dark:text-slate-500">{typLabel(z.typ)}{!jeReaktivni(z) ? ' · ze smlouvy' : ''}</span>
                      {z.stav === 'DOKONCENA' && !z.vyfakturovano && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                          nevyfakturováno
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Technik + stav */}
                  <div className="flex-shrink-0 flex items-center gap-3">
                    <span className="text-sm text-gray-600 dark:text-slate-400 hidden sm:block">
                      {z.technik ? z.technik.jmeno : <span className="italic text-gray-400 dark:text-slate-500">Nepřiřazen</span>}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stavColor(z.stav)}`}>
                      {stavLabel(z.stav)}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
        ))}
        </div>
      )}

      {pohled === 'aktualni' && !fStav && !hledat && counts.smlouvy > 0 && (
        <p className="text-xs text-gray-500 dark:text-slate-400 text-center">
          Dalších {counts.smlouvy} plánovaných návštěv ze smluv za horizontem {SERVIS_HORIZONT_DNI} dní najdeš v pohledu{' '}
          <button onClick={() => setPohled('smlouvy')} className="underline hover:text-gray-700 dark:hover:text-slate-200">Plánované ze smluv</button>.
        </p>
      )}
    </>
  )
}
