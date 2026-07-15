'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Role } from '@prisma/client'
import { useOrgSettings } from '@/context/OrgSettingsContext'
import {
  IconHome, IconUsers, IconBriefcase, IconCoins, IconDocument, IconBox,
  IconActivity, IconChart, IconCog, IconLogout, IconChevronDown, IconChevronLeft,
  IconChevronRight, IconSearch, IconCalendar, IconKey, IconWrench, IconClipboard,
  IconWarehouse, IconBell,
} from '@/components/ui/Icons'

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
        <IconSearch className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
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
      // Servisní zakázky žijí ve skupině Servis (mimo techniky, ti je mají ve skupině Zakázky)
      setActiveGroup(user.role === 'TECHNIK' ? 'zakazky' : 'servis')
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
            <IconChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
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
                  icon={<IconClipboard className="w-5 h-5 flex-shrink-0" />}
                  label="Zakázky"
                />
                {(activeGroup === 'zakazky' || collapsed) && (
                  <div className="space-y-0.5">
                    {collapsed ? (
                      <>
                        <NavItem href="/zakazky" icon={<IconClipboard className="w-5 h-5 flex-shrink-0" />} label="Obchodní zakázky" exact />
                        <NavItem href="/servis/zakazky" icon={<IconWrench className="w-5 h-5 flex-shrink-0" />} label="Servisní zakázky" />
                      </>
                    ) : (
                      <>
                        <SubNavItem href="/zakazky" label="Obchodní zakázky" exact />
                        <SubNavItem href="/servis/zakazky" label="Servisní zakázky" />
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <NavItem href="/zakazky" icon={<IconClipboard className="w-5 h-5 flex-shrink-0" />} label="Moje zakázky" />
            )}
          </>
        ) : (
          <>
            <NavItem href="/dashboard" icon={<IconHome className="w-5 h-5 flex-shrink-0" />} label="Nástěnka" exact />
            <NavItem href="/clients" icon={<IconUsers className="w-5 h-5 flex-shrink-0" />} label="Klienti" />

            {/* Leady - STANDARD+ only, not TECHNIK */}
            {user.plan !== 'STARTER' && orgSettings?.modulLeady !== false && (
              <NavItem href="/leady" icon={<IconBell className="w-5 h-5 flex-shrink-0" />} label="Leady" />
            )}

            {/* Obchod group */}
            <GroupToggle
              open={activeGroup === 'obchod'}
              onToggle={() => setActiveGroup(g => g === 'obchod' ? null : 'obchod')}
              icon={<IconCoins className="w-5 h-5 flex-shrink-0" />}
              label="Obchod"
            />
            {(activeGroup === 'obchod' || collapsed) && (
              <div className="space-y-0.5">
                {collapsed ? (
                  <>
                    <NavItem href="/deals" icon={<IconBriefcase className="w-5 h-5 flex-shrink-0" />} label="Obchodní případy" />
                    <NavItem href="/quote-templates" icon={<IconDocument className="w-5 h-5 flex-shrink-0" />} label="Vzorové nabídky" />
                    <NavItem href="/products" icon={<IconBox className="w-5 h-5 flex-shrink-0" />} label="Produkty" />
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
            {/* Servisní zakázky žijí ve skupině Servis (Professional+ s modulem), ne tady */}
            {user.role !== 'OBCHODNIK' && (
              <>
                <NavItem href="/zakazky" icon={<IconClipboard className="w-5 h-5 flex-shrink-0" />} label="Zakázky" exact />
                <NavItem href="/sklad" icon={<IconWarehouse className="w-5 h-5 flex-shrink-0" />} label="Sklad" />
              </>
            )}

            {/* Aktivity group */}
            <GroupToggle
              open={activeGroup === 'aktivity'}
              onToggle={() => setActiveGroup(g => g === 'aktivity' ? null : 'aktivity')}
              icon={<IconActivity className="w-5 h-5 flex-shrink-0" />}
              label="Aktivity"
            />
            {(activeGroup === 'aktivity' || collapsed) && (
              <div className="space-y-0.5">
                {collapsed ? (
                  <NavItem href="/activities" icon={<IconActivity className="w-5 h-5 flex-shrink-0" />} label="Aktivity" exact />
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
                  icon={<IconWrench className="w-5 h-5 flex-shrink-0" />}
                  label="Servis"
                />
                {(activeGroup === 'servis' || collapsed) && (
                  <div className="space-y-0.5">
                    {collapsed ? (
                      <>
                        <NavItem href="/servis" icon={<IconWrench className="w-5 h-5 flex-shrink-0" />} label="Servis přehled" exact />
                        <NavItem href="/servis/zakazky" icon={<IconClipboard className="w-5 h-5 flex-shrink-0" />} label="Zakázky" />
                      </>
                    ) : (
                      <>
                        <SubNavItem href="/servis" label="Přehled" exact />
                        <SubNavItem href="/servis/zakazky" label="Zakázky" />
                        <SubNavItem href="/servis/zarizeni" label="Zařízení" />
                        <SubNavItem href="/servis/kontrakty" label="Kontrakty" />
                        <SubNavItem href="/servis/plan" label="Plán servisů" />
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            <NavItem href="/calendar" icon={<IconCalendar className="w-5 h-5 flex-shrink-0" />} label="Kalendář" />
            {orgSettings.modulDokumenty && <NavItem href="/documents" icon={<IconDocument className="w-5 h-5 flex-shrink-0" />} label="Dokumenty" />}
            {orgSettings.modulAnalytiky && <NavItem href="/analytics" icon={<IconChart className="w-5 h-5 flex-shrink-0" />} label="Analýzy" />}
          </>
        )}
      </nav>

      {/* Collapse toggle - desktop only */}
      <button
        onClick={toggleCollapse}
        className="absolute -right-3 top-16 bg-[#1A2E1B] border border-green-900 rounded-full w-6 h-6 hidden md:flex items-center justify-center text-green-400/60 hover:text-green-300 hover:bg-green-900/50 transition-colors z-10"
      >
        {collapsed ? <IconChevronRight className="w-3.5 h-3.5" /> : <IconChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Bottom */}
      <div className="border-t border-green-900/50 p-2 space-y-0.5">
        {isAdmin && (
          <NavItem href="/settings" icon={<IconCog className="w-5 h-5 flex-shrink-0" />} label="Nastavení" />
        )}
        {isSuperAdmin && (
          <NavItem href="/superadmin" icon={<IconKey className="w-5 h-5 flex-shrink-0" />} label="Superadmin" />
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
          <IconLogout className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Odhlásit</span>}
        </button>
      </div>
    </aside>
  )
}
