'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const PAGE_LABELS: Record<string, string> = {
  '/settings/profile': 'Můj profil',
  '/settings/users': 'Uživatelé',
  '/settings/company': 'Nastavení firmy',
  '/settings/contract-templates': 'Šablony smluv',
  '/settings/api': 'API klíče',
  '/settings/extensions': 'Rozšíření',
  '/settings/audit-log': 'Historie změn',
  '/settings/evidence': 'Vlastní pole',
  '/settings/billing': 'Fakturace a plán',
  '/settings/features': 'Funkce a přepínače',
  '/settings/import-products': 'Import produktů',
  '/settings/categories': 'Kategorie produktů',
  '/settings/visibility-tree': 'Viditelnost dat',
  '/settings/quotes': 'Šablony nabídek',
}

export default function SettingsBreadcrumb() {
  const pathname = usePathname()
  if (pathname === '/settings') return null

  const label = PAGE_LABELS[pathname] ?? 'Nastavení'

  return (
    <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 mb-5">
      <Link
        href="/settings"
        className="flex items-center gap-1 hover:text-[#4CAF50] dark:hover:text-green-400 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Nastavení
      </Link>
      <span className="text-gray-300 dark:text-slate-600">/</span>
      <span className="text-gray-700 dark:text-slate-200 font-medium">{label}</span>
    </nav>
  )
}
