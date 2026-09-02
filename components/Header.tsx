'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import NotificationBell from './NotificationBell'
import { ROLE_LABELS as roleLabels } from '@/lib/permissions'

interface HeaderProps {
  user: {
    jmeno: string
    email?: string | null
    role: string
  }
  onMenuClick?: () => void
}

const THEME_CYCLE: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="w-9 h-9" />

  const current = (theme ?? 'system') as 'light' | 'dark' | 'system'
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length]

  const titles = { light: 'Světlý režim — přepnout na tmavý', dark: 'Tmavý režim — přepnout na Auto', system: 'Auto (systém) — přepnout na světlý' }

  return (
    <button
      onClick={() => setTheme(next)}
      title={titles[current]}
      className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-green-300/60 hover:bg-[#E8F5E9] dark:hover:bg-green-900/30 transition-colors"
    >
      {current === 'dark' ? (
        <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : current === 'system' ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  )
}

export default function Header({ user, onMenuClick }: HeaderProps) {
  return (
    <header className="bg-[#F9FBF9] dark:bg-[#0D1A0E] border-b border-[#C8E6C9] dark:border-green-900/50 px-4 py-3 flex items-center justify-between flex-shrink-0 transition-colors relative">
      {/* Hamburger button - mobile only */}
      <button
        onClick={onMenuClick}
        className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-green-300/60 hover:bg-[#E8F5E9] dark:hover:bg-green-900/30 transition-colors flex-shrink-0"
        aria-label="Otevřít menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Centered logo - mobile only */}
      <div className="md:hidden absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none">
        <div className="bg-[#4CAF50] rounded p-1">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C8 2 4 5 4 9c0 4 3 7 6 9 1 .6 2 1 2 1s1-.4 2-1c3-2 6-5 6-9 0-4-4-7-8-7z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v8M9 10l3-3 3 3" />
          </svg>
        </div>
        <span className="font-bold text-sm text-gray-900 dark:text-green-100 tracking-wide font-space">FELUCIA</span>
      </div>

      {/* Search trigger - desktop only */}
      <button
        onClick={() => window.dispatchEvent(new Event('felucia:command-palette'))}
        className="hidden md:flex items-center gap-2 w-64 px-3 py-1.5 rounded-lg border border-[#C8E6C9] dark:border-green-900/50 text-gray-400 dark:text-green-300/40 hover:border-primary dark:hover:border-primary text-sm transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="flex-1 text-left">Hledat…</span>
        <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-gray-200 dark:border-green-900/60 text-gray-400 dark:text-green-300/40">⌘K</kbd>
      </button>

      <div className="flex items-center gap-2 md:gap-3">
        <NotificationBell />
        <ThemeToggle />
        <div className="hidden sm:block h-5 w-px bg-[#C8E6C9] dark:bg-green-900/50" />
        <div className="hidden sm:block text-right">
          <p className="text-sm font-semibold text-gray-900 dark:text-green-100">{user.jmeno}</p>
          <p className="text-xs text-gray-500 dark:text-green-400/50">{roleLabels[user.role as keyof typeof roleLabels] ?? user.role}</p>
        </div>
      </div>
    </header>
  )
}
