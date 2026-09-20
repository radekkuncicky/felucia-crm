'use client'

import Link from 'next/link'
import { typLabel, jeUrgentni, SERVIS_HORIZONT_DNI } from '@/lib/servisStav'

interface Item {
  id: string
  cislo: string | null
  typ: string
  stav: string
  popis: string | null
  priorita: string
  planovanyTermin: string | null
  klientNazev: string | null
  predmet: string | null
  technikJmeno: string | null
  technikId: string | null
}

interface Sekce {
  items: Item[]
  /** skutečný počet (items je jen výřez take 8) */
  total: number
}

interface Props {
  stats: { zarizeniCount: number; aktivniKontrakty: number; smlouvyZaHorizontem: number }
  dnes: Item[]
  pozornost: Sekce
  prosle: Sekce
  cekajici: Sekce
  nevyfakturovane: Sekce
  smlouvy30: Item[]
}

const accent = {
  slate: 'text-gray-700 dark:text-slate-300',
  red: 'text-red-600 dark:text-red-400',
  orange: 'text-orange-600 dark:text-orange-400',
  green: 'text-green-600 dark:text-green-400',
}

function fmtCas(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
}

function ItemRow({ item, showDate, showCas }: { item: Item; showDate?: boolean; showCas?: boolean }) {
  return (
    <Link
      href={`/servis/zakazky/${item.id}`}
      className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
    >
      {showDate && item.planovanyTermin && (
        <div className="flex-shrink-0 w-12 text-center">
          <p className="text-sm font-bold text-red-600 dark:text-red-400 leading-none">{new Date(item.planovanyTermin).getDate()}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">{new Date(item.planovanyTermin).toLocaleDateString('cs-CZ', { month: 'short' })}</p>
        </div>
      )}
      {showCas && (
        <div className="flex-shrink-0 w-12 text-center">
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 leading-none">{fmtCas(item.planovanyTermin) ?? '—'}</p>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {item.cislo && <span className="text-xs font-mono text-gray-400 dark:text-slate-500">{item.cislo}</span>}
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.klientNazev ?? '—'}</p>
          {jeUrgentni(item.priorita) && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Urgentní</span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
          {item.popis ?? item.predmet ?? typLabel(item.typ)}
          {item.popis && item.predmet && ` · ${item.predmet}`}
          {!showCas && item.technikJmeno && ` · ${item.technikJmeno}`}
        </p>
      </div>
    </Link>
  )
}

function ActionCard({
  title,
  sekce,
  color,
  showDate,
  emptyText,
  hint,
}: {
  title: string
  sekce: Sekce
  color: keyof typeof accent
  showDate?: boolean
  emptyText: string
  hint?: string
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
          {hint && <p className="text-xs text-gray-500 dark:text-slate-400">{hint}</p>}
        </div>
        <span className={`text-2xl font-bold ${sekce.total === 0 ? 'text-gray-300 dark:text-slate-600' : accent[color]}`}>{sekce.total}</span>
      </div>
      {sekce.items.length === 0 ? (
        <div className="px-5 py-6 text-center text-sm text-gray-400 dark:text-slate-500">{emptyText}</div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-slate-700">
          {sekce.items.map(i => <ItemRow key={i.id} item={i} showDate={showDate} />)}
          {sekce.total > sekce.items.length && (
            <Link href="/servis/zakazky" className="block px-5 py-2 text-xs text-center text-gray-500 dark:text-slate-400 hover:underline">
              a dalších {sekce.total - sekce.items.length} v seznamu →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

// „Dnes v terénu" seskupené podle technika (nepřiřazené zvlášť nahoře — to je k řešení).
function DnesVTerenu({ items }: { items: Item[] }) {
  const skupiny = new Map<string, { jmeno: string; rows: Item[] }>()
  for (const it of items) {
    const k = it.technikId ?? '__none'
    if (!skupiny.has(k)) skupiny.set(k, { jmeno: it.technikJmeno ?? 'Nepřiřazeno', rows: [] })
    skupiny.get(k)!.rows.push(it)
  }
  const poradi = Array.from(skupiny.entries()).sort(([a], [b]) => (a === '__none' ? -1 : b === '__none' ? 1 : 0))

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Dnes v terénu</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">Termín dnes nebo právě probíhá</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-bold ${items.length === 0 ? 'text-gray-300 dark:text-slate-600' : accent.green}`}>{items.length}</span>
          <Link href="/servis/plan" className="text-xs text-primary hover:underline">Plán →</Link>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="px-5 py-6 text-center text-sm text-gray-400 dark:text-slate-500">Dnes nikdo v terénu není</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-slate-700">
          {poradi.map(([k, sk]) => (
            <div key={k} className="min-w-0">
              <div className={`px-5 py-1.5 text-xs font-semibold uppercase tracking-wide ${k === '__none' ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/60'}`}>
                {sk.jmeno} · {sk.rows.length}
              </div>
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {sk.rows.map(i => <ItemRow key={i.id} item={i} showCas />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function QuickLink({ href, title, sub, color, icon }: { href: string; title: string; sub: string; color: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{sub}</p>
      </div>
    </Link>
  )
}

export default function ServisOverviewClient({ stats, dnes, pozornost, prosle, cekajici, nevyfakturovane, smlouvy30 }: Props) {
  return (
    <div className="space-y-4">
      {/* 1. Dnes */}
      <DnesVTerenu items={dnes} />

      {/* 2. Vyžaduje pozornost */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActionCard
          title="Urgentní & nezaplánované"
          hint="Poruchy a opravy bez termínu, urgentní nahoře"
          sekce={pozornost}
          color="red"
          emptyText="Nic nečeká na zaplánování"
        />
        <ActionCard
          title="Prošlé termíny"
          hint="Naplánované, ale termín už minul"
          sekce={prosle}
          color="red"
          showDate
          emptyText="Žádné prošlé termíny"
        />
        <ActionCard
          title="Čeká na díly"
          hint="Pozastavené zakázky"
          sekce={cekajici}
          color="orange"
          emptyText="Nic nečeká"
        />
        <ActionCard
          title="Hotové k vyfakturování"
          hint="Protokol dokončen, vyúčtování chybí"
          sekce={nevyfakturovane}
          color="orange"
          emptyText="Vše vyfakturováno"
        />
      </div>

      {/* 3. Blížící se ze smluv */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Blížící se servisy ze smluv</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">Příštích 30 dní · dalších {stats.smlouvyZaHorizontem} je naplánováno dál než {SERVIS_HORIZONT_DNI} dní</p>
          </div>
          <Link href="/servis/plan" className="text-xs text-primary hover:underline whitespace-nowrap">Otevřít plán →</Link>
        </div>
        {smlouvy30.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-gray-400 dark:text-slate-500">V příštích 30 dnech žádná smluvní návštěva</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {smlouvy30.map(i => <ItemRow key={i.id} item={i} showDate />)}
          </div>
        )}
      </div>

      {/* 4. Rychlé odkazy */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickLink
          href="/servis/zakazky"
          title="Všechny zakázky"
          sub="Seznam s pohledy a hledáním"
          color="bg-green-100 dark:bg-green-900/40"
          icon={<svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
        />
        <QuickLink
          href="/servis/plan"
          title="Plán servisů"
          sub="Týden × technici, drag & drop"
          color="bg-purple-100 dark:bg-purple-900/40"
          icon={<svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
        />
        <QuickLink
          href="/servis/portfolio"
          title="Portfolio"
          sub={`${stats.zarizeniCount} zařízení · ${stats.aktivniKontrakty} smluv`}
          color="bg-teal-100 dark:bg-teal-900/40"
          icon={<svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>}
        />
      </div>
    </div>
  )
}
