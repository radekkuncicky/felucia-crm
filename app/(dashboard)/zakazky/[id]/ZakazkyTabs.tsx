'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

// SVG icon paths (heroicons outline)
const ICONS: Record<string, string> = {
  polozky:    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  technici:   'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0',
  predavaky:  'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  podklady:   'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  vyuctovani: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  foto:       'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z',
  historie:   'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  kontakty:   'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  objednavky: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
}

const TABS = [
  { key: 'polozky',    label: 'Položky' },
  { key: 'objednavky', label: 'Objednávky' },
  { key: 'technici',   label: 'Technici' },
  { key: 'predavaky',  label: 'Protokoly' },
  { key: 'kontakty',   label: 'Kontakty' },
  { key: 'podklady',   label: 'Podklady' },
  { key: 'vyuctovani', label: 'Vyúčtování' },
  { key: 'foto',       label: 'Foto' },
  { key: 'historie',   label: 'Historie' },
]

interface Props {
  zakazkaId: string
  /** zakazkyEdit */
  showTechnici: boolean
  /** financeProdejni */
  showVyuctovani: boolean
  /** zakazkyEdit */
  showHistorie: boolean
  /** sklad !== ZADNY */
  showObjednavky: boolean
}

function Icon({ path }: { path: string }) {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={path} />
    </svg>
  )
}

export default function ZakazkyTabs({ zakazkaId, showTechnici, showVyuctovani, showHistorie, showObjednavky }: Props) {
  const tabs = TABS.filter(t =>
    (t.key !== 'technici' || showTechnici) &&
    (t.key !== 'objednavky' || showObjednavky) &&
    (t.key !== 'vyuctovani' || showVyuctovani) &&
    (t.key !== 'historie' || showHistorie),
  )
  const pathname = usePathname()
  const searchParams = useSearchParams()

  let activeTab = searchParams.get('tab') ?? 'polozky'
  if (pathname.includes('/vyuctovani/')) activeTab = 'vyuctovani'
  if (pathname.includes('/predavaky/')) activeTab = 'predavaky'
  if (pathname.includes('/objednavky/')) activeTab = 'objednavky'

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
