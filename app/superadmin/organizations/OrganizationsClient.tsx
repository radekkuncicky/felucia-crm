'use client'

import { useState } from 'react'
import OrgDetailModal from './OrgDetailModal'
import ConfirmModal from '@/components/ConfirmModal'

const PLAN_COLORS: Record<string, string> = {
  STARTER: 'bg-gray-700 text-gray-200',
  STANDARD: 'bg-green-900 text-green-200',
  PROFESSIONAL: 'bg-blue-900 text-blue-200',
  ENTERPRISE: 'bg-purple-900 text-purple-200',
}

const PLANS = ['STARTER', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE']

interface Org {
  id: string
  nazev: string
  slug: string
  email: string | null
  plan: string
  aktivni: boolean
  vytvoreno: string
  planActiveTo: string | null
  stripeCustomerId: string | null
  _count: { users: number; deals: number; clients: number }
  orgSettings: { modulServis: boolean; modulAnalytiky: boolean; modulDokumenty: boolean; modulDasa: boolean } | null
}

interface Props {
  organizations: Org[]
}

export default function OrganizationsClient({ organizations }: Props) {
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState('')
  const [filterAktivni, setFilterAktivni] = useState<'all' | 'true' | 'false'>('all')
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null)
  const [orgs, setOrgs] = useState(organizations)
  const [deleteOrgId, setDeleteOrgId] = useState<string | null>(null)

  const filtered = orgs.filter(o => {
    if (search && !o.nazev.toLowerCase().includes(search.toLowerCase()) && !(o.email ?? '').toLowerCase().includes(search.toLowerCase())) return false
    if (filterPlan && o.plan !== filterPlan) return false
    if (filterAktivni === 'true' && !o.aktivni) return false
    if (filterAktivni === 'false' && o.aktivni) return false
    return true
  })

  const updateOrg = async (id: string, data: Partial<{ plan: string; aktivni: boolean }>) => {
    await fetch(`/api/superadmin/organizations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setOrgs(prev => prev.map(o => o.id === id ? { ...o, ...data } : o))
    if (selectedOrg?.id === id) setSelectedOrg(prev => prev ? { ...prev, ...data } : prev)
  }

  const deleteOrgConfirm = async () => {
    if (!deleteOrgId) return
    const res = await fetch(`/api/superadmin/organizations/${deleteOrgId}`, { method: 'DELETE' })
    if (res.ok) {
      setOrgs(prev => prev.filter(o => o.id !== deleteOrgId))
      setSelectedOrg(null)
    }
    setDeleteOrgId(null)
  }

  const impersonate = async (orgId: string) => {
    const res = await fetch('/api/superadmin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId }),
    })
    if (res.ok) window.location.href = '/dashboard'
  }

  return (
    <div className="p-8">
      <ConfirmModal
        isOpen={deleteOrgId !== null}
        title="Smazat organizaci"
        message="Opravdu smazat organizaci? Tato akce je nevratná."
        confirmLabel="Smazat"
        danger
        onConfirm={deleteOrgConfirm}
        onCancel={() => setDeleteOrgId(null)}
      />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Organizace</h1>
          <p className="text-gray-400 mt-1">{orgs.length} registrovaných organizací</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hledat organizaci..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
          />
        </div>
        <select
          value={filterPlan}
          onChange={e => setFilterPlan(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
        >
          <option value="">Všechny plány</option>
          {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={filterAktivni}
          onChange={e => setFilterAktivni(e.target.value as 'all' | 'true' | 'false')}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
        >
          <option value="all">Všechny stavy</option>
          <option value="true">Aktivní</option>
          <option value="false">Neaktivní</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-6 py-3 text-gray-400 font-medium">Organizace</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Plán</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Uživatelé</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Obch. případy</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Stav</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Registrace</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(org => (
              <tr key={org.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                <td className="px-6 py-3">
                  <div>
                    <p className="font-medium text-white">{org.nazev}</p>
                    <p className="text-xs text-gray-500">{org.email ?? org.slug}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[org.plan] ?? 'bg-gray-700 text-gray-200'}`}>
                    {org.plan}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300">{org._count.users}</td>
                <td className="px-4 py-3 text-gray-300">{org._count.deals}</td>
                <td className="px-4 py-3">
                  {org.aktivni
                    ? <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                    : <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
                  }
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(org.vytvoreno).toLocaleDateString('cs-CZ')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setSelectedOrg(org)}
                      className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                    >
                      Detail
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-500">Žádné organizace nenalezeny</div>
        )}
      </div>

      {/* Detail modal */}
      {selectedOrg && (
        <OrgDetailModal
          org={selectedOrg}
          onClose={() => setSelectedOrg(null)}
          onUpdate={updateOrg}
          onDelete={async (id) => { setDeleteOrgId(id) }}
          onImpersonate={impersonate}
        />
      )}
    </div>
  )
}
