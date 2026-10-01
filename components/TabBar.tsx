'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useTabs } from '@/context/TabsContext'

export default function TabBar() {
  const { tabs, closeTab, closeAll } = useTabs()
  const router = useRouter()
  const pathname = usePathname()

  const staticTabs = tabs.filter(t => !t.closable)
  const dynamicTabs = tabs.filter(t => t.closable)

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/'
    return pathname === href
  }

  function tabClass(href: string) {
    const active = isActive(href)
    return `relative flex items-center gap-1.5 px-3 h-9 text-xs font-medium whitespace-nowrap cursor-pointer select-none transition-colors ${
      active
        ? 'text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-800 border-b-2 border-[#4CAF50]'
        : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-[#F4FAF4] dark:hover:bg-slate-800/60'
    }`
  }

  return (
    <div className="bg-[#F4FAF4] dark:bg-slate-900 border-b border-[#C8E6C9] dark:border-slate-700 flex items-stretch overflow-hidden shrink-0">
      <div className="flex items-stretch overflow-x-auto scrollbar-none flex-1 min-w-0">
        {staticTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => router.push(tab.href)}
            className={tabClass(tab.href)}
          >
            {tab.label}
          </button>
        ))}

        {dynamicTabs.length > 0 && (
          <div className="w-px bg-[#C8E6C9] dark:bg-slate-700 my-2 shrink-0" />
        )}

        {dynamicTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => router.push(tab.href)}
            className={`${tabClass(tab.href)} group pr-1`}
          >
            <span className="max-w-[160px] truncate">{tab.label}</span>
            <span
              onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
              className="ml-0.5 w-4 h-4 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            >
              ×
            </span>
          </button>
        ))}
      </div>

      {dynamicTabs.length > 0 && (
        <button
          onClick={closeAll}
          className="shrink-0 px-3 h-9 text-xs text-gray-400 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 border-l border-[#C8E6C9] dark:border-slate-700 whitespace-nowrap transition-colors"
        >
          Zavřít vše
        </button>
      )}
    </div>
  )
}
