'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useOrgSettings } from '@/context/OrgSettingsContext'
import { ROLE_LABELS, type Permissions } from '@/lib/permissions'
import { sidebarSections, footerItems, type NavItem as NavItemDef } from '@/lib/navigation'
import { NavIcon } from '@/components/NavIcon'
import { IconLogout, IconChevronLeft, IconChevronRight } from '@/components/ui/Icons'

interface SidebarUser {
  jmeno: string
  role: string
  perms: Permissions
  plan?: string
  isSuperAdmin?: boolean
}

interface Props {
  user: SidebarUser
  orgNazev?: string
}


interface ItemProps {
  item: NavItemDef
  collapsed: boolean
  pathname: string
}

function NavLink({ item, collapsed, pathname }: ItemProps) {
  const isActive = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/')
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors ${collapsed ? 'justify-center' : ''} ${
        isActive
          ? 'bg-[#4CAF50]/15 text-[#4CAF50] border-l-[3px] border-[#4CAF50] pl-[9px]'
          : 'text-green-200/70 hover:bg-green-900/30 hover:text-green-100'
      }`}
    >
      <NavIcon name={item.icon} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )
}

export default function Sidebar({ user, orgNazev }: Props) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const orgSettings = useOrgSettings()

  const ctx = { perms: user.perms, plan: user.plan, orgSettings, isSuperAdmin: user.isSuperAdmin }
  const sections = sidebarSections(ctx)
  const footer = footerItems(ctx)

  useEffect(() => {
    try {
      if (localStorage.getItem('sidebar-collapsed') === 'true') setCollapsed(true)
    } catch {}
  }, [])

  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('sidebar-collapsed', String(next)) } catch {}
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

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto overflow-x-hidden scrollbar-none">
        {sections.map((sec, i) => (
          <div key={sec.id} className={i > 0 ? (collapsed || !sec.title ? 'mt-2 pt-2 border-t border-green-900/40' : 'mt-3') : ''}>
            {sec.title && !collapsed && (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-green-400/45">{sec.title}</p>
            )}
            <div className="space-y-0.5">
              {sec.items.map(item => <NavLink key={item.id} item={item} collapsed={collapsed} pathname={pathname} />)}
            </div>
          </div>
        ))}
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
        {footer.map(item => <NavLink key={item.id} item={item} collapsed={collapsed} pathname={pathname} />)}

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
              <p className="text-xs text-green-400/50">{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}</p>
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
