'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useOrgSettings } from '@/context/OrgSettingsContext'
import type { Permissions } from '@/lib/permissions'
import { bottomNavItems } from '@/lib/navigation'
import { NavIcon } from '@/components/NavIcon'

export default function BottomNav({ perms, plan }: { perms: Permissions; plan?: string }) {
  const pathname = usePathname()
  const orgSettings = useOrgSettings()
  const [dasaOpen, setDasaOpen] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      setDasaOpen((e as CustomEvent<{ open: boolean }>).detail.open)
    }
    window.addEventListener('dasha:statechange', handler)
    return () => window.removeEventListener('dasha:statechange', handler)
  }, [])

  function openDasa() {
    window.dispatchEvent(new Event('dasha:open'))
  }

  // Sada podle role (technik / obchodník / manažer-admin) — viz lib/navigation.ts
  const items = bottomNavItems({ perms, plan, orgSettings })

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-green-900/40 md:hidden pb-safe">
      <div className="flex items-stretch">
        {items.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.id}
              aria-current={isActive ? 'page' : undefined}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs min-h-[56px] transition-colors ${
                isActive
                  ? 'text-[#4CAF50] dark:text-[#66BB6A] font-semibold'
                  : 'text-gray-400 dark:text-slate-500'
              }`}
            >
              <NavIcon name={item.icon} className="w-5 h-5" />
              <span>{item.shortLabel ?? item.label}</span>
            </Link>
          )
        })}

        {/* Dáša button */}
        {orgSettings.modulDasa && (
        <button
          onClick={openDasa}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs min-h-[56px] transition-colors ${
            dasaOpen ? 'text-green-400' : 'text-gray-400 dark:text-slate-500'
          }`}
        >
          <div className="relative">
            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">D</span>
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border border-white dark:border-slate-800" />
          </div>
          <span className={`text-xs font-medium ${dasaOpen ? 'text-green-400' : ''}`}>Dáša</span>
        </button>
        )}
      </div>
    </nav>
  )
}
