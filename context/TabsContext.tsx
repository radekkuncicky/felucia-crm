'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'

export interface Tab {
  id: string
  label: string
  href: string
  closable: boolean
}

const STATIC_TABS: Tab[] = [
  { id: 'dashboard', label: 'Nástěnka', href: '/dashboard', closable: false },
  { id: 'deals', label: 'Obchodní případy', href: '/deals', closable: false },
]

const LS_KEY = 'felucia_tabs'
const MAX_DYNAMIC = 10

function readLS(): Tab[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    return (JSON.parse(raw) as Tab[]).filter(t => t.closable)
  } catch {
    return []
  }
}

function writeLS(tabs: Tab[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(tabs)) } catch {}
}

interface TabsCtx {
  tabs: Tab[]
  activateTab: (tab: Tab) => void
  closeTab: (id: string) => void
  closeAll: () => void
}

const TabsContext = createContext<TabsCtx>({
  tabs: STATIC_TABS,
  activateTab: () => {},
  closeTab: () => {},
  closeAll: () => {},
})

export function TabsProvider({ children, showDeals = true }: { children: React.ReactNode; showDeals?: boolean }) {
  const router = useRouter()
  const [dynamicTabs, setDynamicTabs] = useState<Tab[]>([])

  // Sync from localStorage on mount
  useEffect(() => {
    setDynamicTabs(readLS())
  }, [])

  // Tab „Obchodní případy" jen pro role s obchodem (technika by middleware přesměroval)
  const staticTabs = useMemo(() => showDeals ? STATIC_TABS : STATIC_TABS.filter(t => t.id !== 'deals'), [showDeals])
  const tabs = [...staticTabs, ...dynamicTabs]

  const activateTab = useCallback((tab: Tab) => {
    // Read fresh from localStorage — source of truth across re-mounts
    const current = readLS()
    if (current.find(t => t.id === tab.id)) return
    const next = [...current, tab]
    if (next.length > MAX_DYNAMIC) next.shift()
    writeLS(next)
    setDynamicTabs(next)
  }, [])

  const closeTab = useCallback((id: string) => {
    const current = readLS()
    const idx = current.findIndex(t => t.id === id)
    const next = current.filter(t => t.id !== id)
    writeLS(next)
    setDynamicTabs(next)
    const closedTab = current.find(t => t.id === id)
    if (closedTab && window.location.pathname === closedTab.href) {
      const allNext = [...staticTabs, ...next]
      const target = allNext[Math.max(0, staticTabs.length + idx - 1)] ?? staticTabs[staticTabs.length - 1]
      router.push(target.href)
    }
  }, [router, staticTabs])

  const closeAll = useCallback(() => {
    writeLS([])
    setDynamicTabs([])
    router.push('/dashboard')
  }, [router])

  return (
    <TabsContext.Provider value={{ tabs, activateTab, closeTab, closeAll }}>
      {children}
    </TabsContext.Provider>
  )
}

export function useTabs() {
  return useContext(TabsContext)
}
