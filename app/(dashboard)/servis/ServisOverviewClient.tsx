'use client'

import Link from 'next/link'
import { typLabel } from '@/lib/servisStav'

interface Item {
  id: string
  cislo: string | null
  typ: string
  stav: string
  planovanyTermin: string | null
  klientNazev: string | null
  predmet: string | null
  technikJmeno: string | null
}

interface Props {
  stats: { zarizeniCount: number; aktivniKontrakty: number }
  nezaplanovane: Item[]
  prosle: Item[]
  cekajici: Item[]
  nevyfakturovane: Item[]
}

const accent = {
  slate: 'text-gray-700 dark:text-slate-300',
  red: 'text-red-600 dark:text-red-400',
  orange: 'text-orange-600 dark:text-orange-400',
  green: 'text-green-600 dark:text-green-400',
}

function ItemRow({ item, showDate }: { item: Item; showDate?: boolean }) {
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
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {item.cislo && <span className="text-xs font-mono text-gray-400 dark:text-slate-500">{item.cislo}</span>}
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.klientNazev ?? '—'}</p>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
          {item.predmet ?? typLabel(item.typ)}
          {item.technikJmeno && ` · ${item.technikJmeno}`}
        </p>
      </div>
    </Link>
  )
}

function ActionCard({
  title,
  items,
  color,
  showDate,
  emptyText,
}: {
  title: string
  items: Item[]
  color: keyof typeof accent
  showDate?: boolean
  emptyText: string
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
        <span className={`text-2xl font-bold ${accent[color]}`}>{items.length}{items.length === 8 ? '+' : ''}</span>
      </div>
      {items.length === 0 ? (
        <div className="px-5 py-6 text-center text-sm text-gray-400 dark:text-slate-500">{emptyText}</div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-slate-700">
          {items.map(i => <ItemRow key={i.id} item={i} showDate={showDate} />)}
        </div>
      )}
    </div>
  )
}

export default function ServisOverviewClient({ stats, nezaplanovane, prosle, cekajici, nevyfakturovane }: Props) {
  return (
    <div className="space-y-4">
      {/* Akční sekce */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActionCard
          title="Prošlé termíny"
          items={prosle}
          color="red"
          showDate
          emptyText="Žádné prošlé termíny"
        />
        <ActionCard
          title="Nezaplánované"
          items={nezaplanovane}
          color="slate"
          emptyText="Vše naplánováno"
        />
        <ActionCard
          title="Čeká na díly"
          items={cekajici}
          color="orange"
          emptyText="Nic nečeká"
        />
        <ActionCard
          title="Hotové k vyfakturování"
          items={nevyfakturovane}
          color="red"
          emptyText="Vše vyfakturováno"
        />
      </div>

      {/* Rychlé odkazy + statistiky */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/servis/zakazky" className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Všechny zakázky</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Seznam s filtry</p>
          </div>
        </Link>
        <Link href="/servis/zarizeni" className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-primary dark:text-primary-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Zařízení</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">{stats.zarizeniCount} aktivních</p>
          </div>
        </Link>
        <Link href="/servis/kontrakty" className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Kontrakty</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">{stats.aktivniKontrakty} aktivních</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
