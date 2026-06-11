'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Role } from '@prisma/client'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomNav from './BottomNav'
import TabBar from './TabBar'
import { TabsProvider } from '@/context/TabsContext'
import { OrgSettingsProvider } from '@/context/OrgSettingsContext'
import type { OrgSettingsData } from '@/lib/orgSettings'

interface User {
  jmeno: string
  email?: string | null
  role: Role
  plan?: string
  isSuperAdmin?: boolean
  serviceAccess?: boolean
}

export default function DashboardShell({ user, orgSettings, orgNazev, children }: { user: User; orgSettings: OrgSettingsData; orgNazev?: string; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  // Prevent document-level scroll on mobile so BottomNav stays fixed
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
      document.documentElement.style.overflow = ''
    }
  }, [])

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  return (
    <OrgSettingsProvider settings={orgSettings}>
    <TabsProvider>
      <div className="flex h-[100dvh] bg-[#F9FBF9] dark:bg-[#0A120A] transition-colors overflow-hidden">
        {/* Mobile overlay backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar wrapper: fixed overlay on mobile, static flex item on desktop */}
        <div
          className={`fixed inset-y-0 left-0 z-50 md:static md:inset-auto transition-transform duration-200 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <Sidebar user={{ jmeno: user.jmeno, role: user.role, plan: user.plan, isSuperAdmin: user.isSuperAdmin, serviceAccess: user.serviceAccess }} orgNazev={orgNazev} />
        </div>

        {/* Main area */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <Header user={user} onMenuClick={() => setSidebarOpen(true)} />
          <TabBar />
          <main className="flex-1 overflow-auto p-4 md:p-6 pb-safe-nav md:pb-6">
            {children}
          </main>
        </div>

        <BottomNav role={user.role} />
      </div>
    </TabsProvider>
    </OrgSettingsProvider>
  )
}
