'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Role } from '@prisma/client'
import { useOrgSettings } from '@/context/OrgSettingsContext'

interface SidebarUser {
  jmeno: string
  role: Role
  plan?: string
  isSuperAdmin?: boolean
  serviceAccess?: boolean
}

interface Props {
  user: SidebarUser
  orgNazev?: string
}

const Icon = {
  dashboard: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
  sun: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10 5 5 0 000-10z" />,
  clients: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
  deals: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
  dollar: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  quotes: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  products: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
  activities: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
  chart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  settings: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>,
  logout: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
  chevronDown: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />,
  chevronLeft: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />,
  chevronRight: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />,
  search: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
  calendar: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  contract: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
  document: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />,
  key: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />,
  wrench: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />,
  clipboard: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></>,
  warehouse: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7m16 0l-8 4-8-4m0 5l8 4 8-4" />,
  leads: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
}

function NavIcon({ d }: { d: React.ReactNode }) {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {d}
    </svg>
  )
}

interface SearchResult {
  type: 'client' | 'deal'
  id: string
  label: string
  sub: string
  href: string
}

function SidebarSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data)
        setOpen(true)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => search(query), 300)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [query, search])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative px-3 py-2">
      <div className="relative">
        <svg className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {Icon.search}
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Hledat…"
          className="w-full bg-[#0D1A0E] border border-green-900/60 rounded-lg pl-8 pr-3 py-1.5 text-sm text-green-100 placeholder-green-400/40 focus:outline-none focus:border-[#4CAF50] focus:ring-1 focus:ring-[#4CAF50]/50"
        />
        {loading && (
          <div className="absolute right-2.5 top-2 w-4 h-4 border-2 border-[#4CAF50] border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-[#0D1A0E] border border-green-900/60 rounded-lg shadow-xl z-50 overflow-hidden">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => { router.push(r.href); setOpen(false); setQuery('') }}
              className="w-full px-3 py-2 flex items-start gap-2 hover:bg-green-900/30 text-left transition-colors"
            >
              <span className={`text-xs mt-0.5 px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${r.type === 'client' ? 'bg-green-900/60 text-green-300' : 'bg-[#4CAF50]/20 text-[#4CAF50]'}`}>
                {r.type === 'client' ? 'KL' : 'OP'}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-green-100 truncate">{r.label}</p>
                <p className="text-xs text-green-400/50 truncate">{r.sub}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-[#0D1A0E] border border-green-900/60 rounded-lg shadow-xl z-50 px-3 py-2">
          <p className="text-sm text-green-400/50">Žádné výsledky</p>
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ user, orgNazev }: Props) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const isPlatinum = user.plan === 'PROFESSIONAL' || user.plan === 'ENTERPRISE'
  const orgSettings = useOrgSettings()

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
    if (pathname.startsWith('/deals') || pathname.startsWith('/products') || pathname.startsWith('/quote-templates') || pathname.startsWith('/quotes')) {
      setActiveGroup('obchod')
    } else if (pathname.startsWith('/activities')) {
      setActiveGroup('aktivity')
    } else if (pathname.startsWith('/servis')) {
      setActiveGroup('servis')
    } else if (pathname.startsWith('/zakazky')) {
      setActiveGroup('zakazky')
    } else if (pathname.startsWith('/leady')) {
      setActiveGroup(null)
    } else {
      setActiveGroup(null)
    }
  }, [pathname])

  const isTechnik = user.role === 'TECHNIK'
  const hasServiceAccess = user.serviceAccess ?? false

  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  const isAdmin = user.role === 'ADMIN'
  const isSuperAdmin = user.isSuperAdmin ?? false

  function NavItem({ href, icon, label, exact = false }: { href: string; icon: React.ReactNode; label: string; exact?: boolean }) {
    const isActive = exact ? pathname === href : pathname.startsWith(href)
    return (
      <Link
        href={href}
        title={collapsed ? label : undefined}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${collapsed ? 'justify-center' : ''} ${
          isActive
            ? 'bg-[#4CAF50]/15 text-[#4CAF50] border-l-[3px] border-[#4CAF50] pl-[9px]'
            : 'text-green-200/70 hover:bg-green-900/30 hover:text-green-100'
        }`}
      >
        {icon}
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    )
  }

  function GroupToggle({ open, onToggle, icon, label }: { open: boolean; onToggle: () => void; icon: React.ReactNode; label: string }) {
    return (
      <button
        onClick={collapsed ? undefined : onToggle}
        title={collapsed ? label : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-green-200/70 hover:bg-green-900/30 hover:text-green-100 transition-colors ${collapsed ? 'justify-center' : ''}`}
      >
        {icon}
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate">{label}</span>
            <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {Icon.chevronDown}
            </svg>
          </>
        )}
      </button>
    )
  }

  function SubNavItem({ href, label, exact = false }: { href: string; label: string; exact?: boolean }) {
    const isActive = exact ? pathname === href : pathname.startsWith(href)
    if (collapsed) return null
    return (
      <Link
        href={href}
        className={`flex items-center gap-2 pl-9 pr-3 py-1.5 rounded-lg text-sm transition-colors ${
          isActive ? 'text-[#4CAF50] bg-[#4CAF50]/10' : 'text-green-200/60 hover:text-green-100 hover:bg-green-900/30'
        }`}
      >
        <span className="w-1 h-1 rounded-full bg-current flex-shrink-0" />
        <span className="truncate">{label}</span>
      </Link>
    )
  }

  const initials = user.jmeno.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <aside
      className="flex flex-col bg-[#1A2E1B] flex-shrink-0 transition-all duration-200 relative h-full"
      style={{ width: collapsed ? 64 : 240 }}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b border-green-900/50 bg-[#0D1A0E] ${collapsed ? 'justify-center' : ''}`}>
        <div className="bg-[#4CAF50] rounded-lg p-1.5 flex-shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C8 2 4 5 4 9c0 4 3 7 6 9 1 .6 2 1 2 1s1-.4 2-1c3-2 6-5 6-9 0-4-4-7-8-7z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v8M9 10l3-3 3 3" />
          </svg>
        </div>
        {!collapsed && (
          <div>
            <p className="font-bold text-white leading-tight font-space">FELUCIA CRM</p>
            <p className="text-xs text-green-400/60 truncate max-w-[150px]">{orgNazev ?? 'HVAC systémy'}</p>
          </div>
        )}
      </div>

      {/* Search */}
      {!collapsed && <SidebarSearch />}

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden scrollbar-none">
        {isTechnik ? (
          <>
            {hasServiceAccess ? (
              <>
                <GroupToggle
                  open={activeGroup === 'zakazky'}
                  onToggle={() => setActiveGroup(g => g === 'zakazky' ? null : 'zakazky')}
                  icon={<NavIcon d={Icon.clipboard} />}
                  label="Zakázky"
                />
                {(activeGroup === 'zakazky' || collapsed) && (
                  <div className="space-y-0.5">
                    {collapsed ? (
                      <>
                        <NavItem href="/zakazky" icon={<NavIcon d={Icon.clipboard} />} label="Obchodní zakázky" exact />
                        <NavItem href="/zakazky/servisni" icon={<NavIcon d={Icon.wrench} />} label="Servisní zakázky" />
                      </>
                    ) : (
                      <>
                        <SubNavItem href="/zakazky" label="Obchodní zakázky" exact />
                        <SubNavItem href="/zakazky/servisni" label="Servisní zakázky" />
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <NavItem href="/zakazky" icon={<NavIcon d={Icon.clipboard} />} label="Moje zakázky" />
            )}
          </>
        ) : (
          <>
            <NavItem href="/dashboard" icon={<NavIcon d={Icon.dashboard} />} label="Nástěnka" exact />
            <NavItem href="/clients" icon={<NavIcon d={Icon.clients} />} label="Klienti" />

            {/* Leady - STANDARD+ only, not TECHNIK */}
            {user.plan !== 'STARTER' && orgSettings?.modulLeady !== false && (
              <NavItem href="/leady" icon={<NavIcon d={Icon.leads} />} label="Leady" />
            )}

            {/* Obchod group */}
            <GroupToggle
              open={activeGroup === 'obchod'}
              onToggle={() => setActiveGroup(g => g === 'obchod' ? null : 'obchod')}
              icon={<NavIcon d={Icon.dollar} />}
              label="Obchod"
            />
            {(activeGroup === 'obchod' || collapsed) && (
              <div className="space-y-0.5">
                {collapsed ? (
                  <>
                    <NavItem href="/deals" icon={<NavIcon d={Icon.deals} />} label="Obchodní případy" />
                    <NavItem href="/quote-templates" icon={<NavIcon d={Icon.quotes} />} label="Vzorové nabídky" />
                    <NavItem href="/products" icon={<NavIcon d={Icon.products} />} label="Produkty" />
                  </>
                ) : (
                  <>
                    <SubNavItem href="/deals" label="Obchodní případy" />
                    <SubNavItem href="/quote-templates" label="Vzorové nabídky" />
                    <SubNavItem href="/products" label="Produkty" />
                  </>
                )}
              </div>
            )}

            {/* Zakázky + Sklad - not for OBCHODNIK */}
            {user.role !== 'OBCHODNIK' && (
              <>
                {hasServiceAccess ? (
                  <>
                    <GroupToggle
                      open={activeGroup === 'zakazky'}
                      onToggle={() => setActiveGroup(g => g === 'zakazky' ? null : 'zakazky')}
                      icon={<NavIcon d={Icon.clipboard} />}
                      label="Zakázky"
                    />
                    {(activeGroup === 'zakazky' || collapsed) && (
                      <div className="space-y-0.5">
                        {collapsed ? (
                          <>
                            <NavItem href="/zakazky" icon={<NavIcon d={Icon.clipboard} />} label="Obchodní zakázky" exact />
                            <NavItem href="/zakazky/servisni" icon={<NavIcon d={Icon.wrench} />} label="Servisní zakázky" />
                          </>
                        ) : (
                          <>
                            <SubNavItem href="/zakazky" label="Obchodní zakázky" exact />
                            <SubNavItem href="/zakazky/servisni" label="Servisní zakázky" />
                          </>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <NavItem href="/zakazky" icon={<NavIcon d={Icon.clipboard} />} label="Zakázky" />
                )}
                <NavItem href="/sklad" icon={<NavIcon d={Icon.warehouse} />} label="Sklad" />
              </>
            )}

            {/* Aktivity group */}
            <GroupToggle
              open={activeGroup === 'aktivity'}
              onToggle={() => setActiveGroup(g => g === 'aktivity' ? null : 'aktivity')}
              icon={<NavIcon d={Icon.activities} />}
              label="Aktivity"
            />
            {(activeGroup === 'aktivity' || collapsed) && (
              <div className="space-y-0.5">
                {collapsed ? (
                  <NavItem href="/activities" icon={<NavIcon d={Icon.activities} />} label="Aktivity" exact />
                ) : (
                  <>
                    <SubNavItem href="/activities" label="Přehled" exact />
                    <SubNavItem href="/activities?typ=UKOL" label="Úkoly" />
                    <SubNavItem href="/activities?typ=SCHUZKA" label="Schůzky" />
                    <SubNavItem href="/activities?typ=EMAIL" label="Emaily" />
                    <SubNavItem href="/activities?typ=HOVOR" label="Telefonáty" />
                    <SubNavItem href="/activities?typ=POZNAMKA" label="Poznámky" />
                  </>
                )}
              </div>
            )}

            {/* Servis group - Professional/Enterprise only + module enabled */}
            {isPlatinum && orgSettings.modulServis && (
              <>
                <GroupToggle
                  open={activeGroup === 'servis'}
                  onToggle={() => setActiveGroup(g => g === 'servis' ? null : 'servis')}
                  icon={<NavIcon d={Icon.wrench} />}
                  label="Servis"
                />
                {(activeGroup === 'servis' || collapsed) && (
                  <div className="space-y-0.5">
                    {collapsed ? (
                      <NavItem href="/servis" icon={<NavIcon d={Icon.wrench} />} label="Servis přehled" exact />
                    ) : (
                      <>
                        <SubNavItem href="/servis" label="Přehled" exact />
                        <SubNavItem href="/servis/zarizeni" label="Zařízení" />
                        <SubNavItem href="/servis/kontrakty" label="Kontrakty" />
                        <SubNavItem href="/servis/plan" label="Plán servisů" />
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            <NavItem href="/calendar" icon={<NavIcon d={Icon.calendar} />} label="Kalendář" />
            <div className="hidden md:block space-y-0.5">
              {orgSettings.modulDokumenty && <NavItem href="/documents" icon={<NavIcon d={Icon.document} />} label="Dokumenty" />}
              {orgSettings.modulAnalytiky && <NavItem href="/analytics" icon={<NavIcon d={Icon.chart} />} label="Analýzy" />}
            </div>
          </>
        )}
      </nav>

      {/* Collapse toggle - desktop only */}
      <button
        onClick={toggleCollapse}
        className="absolute -right-3 top-16 bg-[#1A2E1B] border border-green-900 rounded-full w-6 h-6 hidden md:flex items-center justify-center text-green-400/60 hover:text-green-300 hover:bg-green-900/50 transition-colors z-10"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {collapsed ? Icon.chevronRight : Icon.chevronLeft}
        </svg>
      </button>

      {/* Bottom */}
      <div className="border-t border-green-900/50 p-2 space-y-0.5">
        {isAdmin && (
          <div className="hidden md:block">
            <NavItem href="/settings" icon={<NavIcon d={Icon.settings} />} label="Nastavení" />
          </div>
        )}
        {isSuperAdmin && (
          <div className="hidden md:block">
            <NavItem href="/superadmin" icon={<NavIcon d={Icon.key} />} label="Superadmin" />
          </div>
        )}

        <Link
          href="/settings/profile"
          title={collapsed ? 'Můj profil' : undefined}
          className={`flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-green-900/30 transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <div className="w-8 h-8 rounded-full bg-[#4CAF50] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-green-100 truncate">{user.jmeno}</p>
              <p className="text-xs text-green-400/50">{user.role === 'ADMIN' ? 'Admin' : user.role === 'OBCHODNIK' ? 'Obchodník' : 'Technik'}</p>
            </div>
          )}
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          title="Odhlásit"
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-green-200/50 hover:text-green-100 hover:bg-green-900/30 transition-colors text-xs ${collapsed ? 'justify-center' : ''}`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {Icon.logout}
          </svg>
          {!collapsed && <span>Odhlásit</span>}
        </button>
      </div>
    </aside>
  )
}
