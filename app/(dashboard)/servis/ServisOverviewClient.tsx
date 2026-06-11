'use client'

import Link from 'next/link'

const STAV_LABELS: Record<string, string> = {
  PLANOVANA: 'Plánovaná',
  POTVRZENA: 'Potvrzená',
  PROBIHA: 'Probíhá',
  DOKONCENA: 'Dokončená',
  ZRUSENA: 'Zrušená',
  PRESLA: 'Prošlá',
}

const STAV_COLORS: Record<string, string> = {
  PLANOVANA: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  POTVRZENA: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  PROBIHA: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  DOKONCENA: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300',
  ZRUSENA: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  PRESLA: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
}

const TYP_LABELS: Record<string, string> = {
  PLANOVANY_SERVIS: 'Plánovaný servis',
  PORUCHA: 'Porucha',
  ZARUCNI_OPRAVA: 'Záruční oprava',
  POZARUCNI_OPRAVA: 'Pozáruční oprava',
  UVEDENI_DO_PROVOZU: 'Uvedení do provozu',
  KONTROLA: 'Kontrola',
}

interface Stats {
  zarizeniCount: number
  aktivniKontrakty: number
  nadchazejiNavstevy: number
  presleNavstevy: number
}

interface Navsteva {
  id: string
  stav: string
  typ: string
  planovanyTermin: string
  cisloNavstevy: string | null
  technik: { id: string; jmeno: string } | null
  kontrakt: {
    klient: { id: string; jmeno: string; prijmeni: string }
    nazev: string
    cisloKontraktu: string | null
  } | null
  zarizeni: { id: string; nazev: string; typ: string } | null
}

interface Props {
  stats: Stats
  upcomingNavstevy: Navsteva[]
}

function StatCard({ label, value, href, color }: { label: string; value: number; href: string; color: string }) {
  return (
    <Link href={href} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow block">
      <p className="text-sm text-gray-500 dark:text-slate-400">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </Link>
  )
}

export default function ServisOverviewClient({ stats, upcomingNavstevy }: Props) {
  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Aktivní zařízení" value={stats.zarizeniCount} href="/servis/zarizeni" color="text-primary dark:text-primary-light" />
        <StatCard label="Aktivní kontrakty" value={stats.aktivniKontrakty} href="/servis/kontrakty" color="text-green-600 dark:text-green-400" />
        <StatCard label="Návštěvy (30 dní)" value={stats.nadchazejiNavstevy} href="/servis/plan" color="text-teal-600 dark:text-teal-400" />
        <StatCard
          label="Prošlé návštěvy"
          value={stats.presleNavstevy}
          href="/servis/plan"
          color={stats.presleNavstevy > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-slate-400'}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/servis/zarizeni" className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-primary dark:text-primary-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Zařízení</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Správa instalovaných zařízení</p>
          </div>
        </Link>
        <Link href="/servis/kontrakty" className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Kontrakty</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Servisní smlouvy a plánování</p>
          </div>
        </Link>
        <Link href="/servis/plan" className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Plán servisů</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Kalendář návštěv</p>
          </div>
        </Link>
      </div>

      {/* Upcoming visits */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Nadcházející návštěvy (30 dní)</h2>
          <Link href="/servis/plan" className="text-sm text-primary dark:text-primary-light hover:underline">
            Zobrazit vše
          </Link>
        </div>
        {upcomingNavstevy.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500 dark:text-slate-400 text-sm">
            Žádné naplánované návštěvy v příštích 30 dnech
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {upcomingNavstevy.map(n => {
              const isPast = new Date(n.planovanyTermin) < new Date()
              return (
                <div key={n.id} className="px-6 py-3 flex items-center gap-4">
                  <div className="flex-shrink-0 text-center w-12">
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {new Date(n.planovanyTermin).toLocaleDateString('cs-CZ', { day: '2-digit', month: 'short' })}
                    </p>
                    {isPast && <span className="text-xs text-red-500 font-medium">prošlé</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {n.kontrakt?.klient
                        ? `${n.kontrakt.klient.jmeno} ${n.kontrakt.klient.prijmeni}`
                        : '—'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                      {n.zarizeni?.nazev ?? n.kontrakt?.nazev ?? '—'}
                      {n.technik && ` · ${n.technik.jmeno}`}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-slate-400">{TYP_LABELS[n.typ] ?? n.typ}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAV_COLORS[n.stav]}`}>
                      {STAV_LABELS[n.stav]}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
