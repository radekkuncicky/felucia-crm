'use client'

import Link from 'next/link'
import { getPlanLimits } from '@/lib/planLimits'

const ICONS: Record<string, string> = {
  prehled:        'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  nabidky:        'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  smlouvy:        'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  aktivity:       'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  zamereni:       'M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z',
  fotodokumentace:'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z',
  dokumenty:      'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  servis:         'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
}

const baseTabs = [
  { key: 'prehled',         label: 'Přehled' },
  { key: 'nabidky',         label: 'Nabídky' },
  { key: 'smlouvy',         label: 'Smlouvy' },
  { key: 'aktivity',        label: 'Aktivity' },
  { key: 'zamereni',        label: 'Zaměření' },
  { key: 'fotodokumentace', label: 'Foto' },
  { key: 'dokumenty',       label: 'Dokumenty' },
]

interface Props {
  dealId: string
  activeTab: string
  hasServisKontrakt?: boolean
  plan?: string
}

function Icon({ path }: { path: string }) {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={path} />
    </svg>
  )
}

export default function DealTabs({ dealId, activeTab, hasServisKontrakt, plan }: Props) {
  const tabs = [...baseTabs]
  if (getPlanLimits(plan ?? 'STARTER').hasServiceModule && hasServisKontrakt) {
    tabs.push({ key: 'servis', label: 'Servis' })
  }

  return (
    <div className="sticky top-0 z-20 relative bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
      {/* Fade edges */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white dark:from-slate-800 to-transparent z-10 rounded-l-xl" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white dark:from-slate-800 to-transparent z-10 rounded-r-xl" />
      <nav className="flex gap-1.5 overflow-x-auto scrollbar-none px-3 py-2">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab
          return (
            <Link
              key={tab.key}
              href={`/deals/${dealId}?tab=${tab.key}`}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium rounded-full transition-colors flex-shrink-0 ${
                isActive
                  ? 'bg-[#1B5E20] text-white'
                  : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon path={ICONS[tab.key] ?? ICONS.prehled} />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
