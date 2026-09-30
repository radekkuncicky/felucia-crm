'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ZAKAZKA_TABY, resolveZakazkaTab, zakazkaTabZCesty, type ZakazkaTab } from '@/lib/zakazkaTaby'

// SVG icon paths (heroicons outline)
const ICONS: Record<string, string> = {
  polozky:    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  protokoly:  'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  podklady:   'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  historie:   'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  kontakty:   'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  ukoly:      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
}

interface Props {
  zakazkaId: string
  /** Výchozí tab podle role (technik → protokoly) */
  defaultTab: ZakazkaTab
  /** zakazkyEdit */
  showHistorie: boolean
}

function Icon({ path }: { path: string }) {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={path} />
    </svg>
  )
}

export default function ZakazkyTabs({ zakazkaId, defaultTab, showHistorie }: Props) {
  const tabs = ZAKAZKA_TABY.filter(t => t.key !== 'historie' || showHistorie)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeTab = zakazkaTabZCesty(pathname) ?? resolveZakazkaTab(searchParams.get('tab') ?? undefined, defaultTab).tab

  return (
    <div className="sticky top-0 z-20 relative bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
      {/* Fade edges to hint scrollability */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white dark:from-slate-800 to-transparent z-10 rounded-l-xl" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white dark:from-slate-800 to-transparent z-10 rounded-r-xl" />
      <nav className="flex gap-1.5 overflow-x-auto scrollbar-none px-3 py-2">
        {tabs.map(tab => {
          const isActive = tab.key === activeTab
          return (
            <Link
              key={tab.key}
              href={`/zakazky/${zakazkaId}?tab=${tab.key}`}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium rounded-full transition-colors flex-shrink-0 ${
                isActive
                  ? 'bg-[#1B5E20] text-white'
                  : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon path={ICONS[tab.key]} />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
