'use client'

import { useState } from 'react'
import { formatDate } from '@/lib/format'

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-900 text-purple-200',
  OBCHODNIK: 'bg-blue-900 text-blue-200',
  TECHNIK: 'bg-green-900 text-green-200',
}

const PLAN_COLORS: Record<string, string> = {
  STARTER: 'bg-gray-700 text-gray-300',
  STANDARD: 'bg-green-900 text-green-300',
  PROFESSIONAL: 'bg-blue-900 text-blue-300',
  ENTERPRISE: 'bg-yellow-900 text-yellow-300',
}

interface User {
  id: string
  jmeno: string
  email: string
  role: string
  aktivni: boolean
  isSuperAdmin: boolean
  vytvoreno: string
  lastLoginAt: string | null
  orgId: string
  orgNazev: string
  orgPlan: string
}

interface Org {
  id: string
  nazev: string
}

export default function UsersClient({ users, orgs }: { users: User[]; orgs: Org[] }) {
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterOrg, setFilterOrg] = useState('')
  const [filterActivity, setFilterActivity] = useState('')

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const filtered = users.filter(u => {
    if (search) {
      const q = search.toLowerCase()
      if (!u.jmeno.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !u.orgNazev.toLowerCase().includes(q)) return false
    }
    if (filterRole && u.role !== filterRole) return false
    if (filterOrg && u.orgId !== filterOrg) return false
    if (filterActivity === 'active') {
      // Aktivní = přihlášen v posl. 30 dnech NEBO nikdy nepřihlášen ale registrován v posl. 30 dnech
      const loginRecent = u.lastLoginAt && new Date(u.lastLoginAt) >= thirtyDaysAgo
      const newUser = !u.lastLoginAt && new Date(u.vytvoreno) >= thirtyDaysAgo
      if (!loginRecent && !newUser) return false
    }
    if (filterActivity === 'inactive') {
      // Neaktivní = přihlášen před více než 30 dny (nebo nikdy) A registrován před více než 30 dny
      const loginOld = !u.lastLoginAt || new Date(u.lastLoginAt) < thirtyDaysAgo
      const registeredOld = new Date(u.vytvoreno) < thirtyDaysAgo
      if (!loginOld || !registeredOld) return false
    }
    return true
  })

  function formatLastLogin(iso: string | null): { text: string; cls: string } {
    if (!iso) return { text: 'Nikdy', cls: 'text-gray-500' }
    const d = new Date(iso)
    const diffMs = Date.now() - d.getTime()
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (days === 0) return { text: 'Dnes', cls: 'text-green-400' }
    if (days === 1) return { text: 'Včera', cls: 'text-green-400' }
    if (days < 30) return { text: `před ${days} dny`, cls: 'text-green-400' }
    return { text: formatDate(d), cls: 'text-red-400' }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Uživatelé</h1>
        <p className="text-gray-400 mt-1">{users.length} uživatelů napříč všemi organizacemi</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hledat uživatele..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
          />
        </div>
        <select
          value={filterOrg}
          onChange={e => setFilterOrg(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
        >
          <option value="">Všechny org</option>
          {orgs.map(o => (
            <option key={o.id} value={o.id}>{o.nazev}</option>
          ))}
        </select>
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
        >
          <option value="">Všechny role</option>
          <option value="ADMIN">Admin</option>
          <option value="OBCHODNIK">Obchodník</option>
          <option value="TECHNIK">Technik</option>
        </select>
        <select
          value={filterActivity}
          onChange={e => setFilterActivity(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
        >
          <option value="">Veškerá aktivita</option>
          <option value="active">Aktivní (posl. 30 dní)</option>
          <option value="inactive">Neaktivní</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-6 py-3 text-gray-400 font-medium">Jméno</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Organizace</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Role</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Plán</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Posl. přihlášení</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">SA</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(user => (
              <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                <td className="px-6 py-3">
                  <p className="font-medium text-white">{user.jmeno}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </td>
                <td className="px-4 py-3 text-gray-300 text-sm">{user.orgNazev}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] ?? 'bg-gray-700 text-gray-200'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[user.orgPlan] ?? 'bg-gray-700 text-gray-300'}`}>
                    {user.orgPlan}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {(() => { const { text, cls } = formatLastLogin(user.lastLoginAt); return <span className={cls}>{text}</span> })()}
                </td>
                <td className="px-4 py-3">
                  {user.isSuperAdmin && (
                    <span className="text-xs bg-yellow-900 text-yellow-300 px-1.5 py-0.5 rounded font-medium">SA</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-500">Žádní uživatelé nenalezeni</div>
        )}
      </div>
    </div>
  )
}
