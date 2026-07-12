'use client'

import { useState } from 'react'
import { formatDateTime } from '@/lib/format'

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-900 text-green-300',
  UPDATE: 'bg-blue-900 text-blue-300',
  DELETE: 'bg-red-900 text-red-300',
}

interface Log {
  id: string
  orgId: string
  orgNazev: string
  userId: string | null
  userJmeno: string | null
  userEmail: string | null
  typAkce: string
  typZaznamu: string
  zaznamId: string
  zaznamNazev: string
  zmeny: unknown
  vytvoreno: string
}

export default function LogsClient({ logs }: { logs: Log[] }) {
  const [search, setSearch] = useState('')
  const [filterTyp, setFilterTyp] = useState('')
  const [filterOrg, setFilterOrg] = useState('')

  const orgs = Array.from(new Set(logs.map(l => l.orgNazev))).sort()
  const typy = Array.from(new Set(logs.map(l => l.typZaznamu))).sort()

  const filtered = logs.filter(l => {
    if (search && !l.zaznamNazev.toLowerCase().includes(search.toLowerCase()) && !(l.userJmeno ?? '').toLowerCase().includes(search.toLowerCase())) return false
    if (filterTyp && l.typZaznamu !== filterTyp) return false
    if (filterOrg && l.orgNazev !== filterOrg) return false
    return true
  })

  const exportCsv = () => {
    const headers = ['Datum', 'Organizace', 'Uživatel', 'Akce', 'Typ záznamu', 'Záznam']
    const rows = filtered.map(l => [
      formatDateTime(l.vytvoreno),
      l.orgNazev,
      l.userJmeno ?? '—',
      l.typAkce,
      l.typZaznamu,
      l.zaznamNazev,
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit logy</h1>
          <p className="text-gray-400 mt-1">Posledních 200 záznamů napříč všemi organizacemi</p>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
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
            placeholder="Hledat v záznamech..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
          />
        </div>
        <select
          value={filterOrg}
          onChange={e => setFilterOrg(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
        >
          <option value="">Všechny organizace</option>
          {orgs.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select
          value={filterTyp}
          onChange={e => setFilterTyp(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
        >
          <option value="">Všechny typy</option>
          {typy.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-6 py-3 text-gray-400 font-medium">Datum</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Organizace</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Uživatel</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Akce</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Typ záznamu</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Záznam</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(log => (
              <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                <td className="px-6 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {formatDateTime(log.vytvoreno)}
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs">{log.orgNazev}</td>
                <td className="px-4 py-3">
                  <p className="text-gray-300 text-xs">{log.userJmeno ?? '—'}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[log.typAkce] ?? 'bg-gray-700 text-gray-300'}`}>
                    {log.typAkce}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{log.typZaznamu}</td>
                <td className="px-4 py-3 text-gray-300 text-xs max-w-xs truncate">{log.zaznamNazev}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-500">Žádné záznamy nenalezeny</div>
        )}
      </div>
    </div>
  )
}
