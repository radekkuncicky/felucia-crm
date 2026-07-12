'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { LeadZdroj, LeadStatus } from '@prisma/client'
import { formatDate, formatKcPresne } from '@/lib/format'

interface Lead {
  id: string
  jmeno: string
  email: string | null
  telefon: string | null
  firma: string | null
  zdroj: LeadZdroj
  status: LeadStatus
  assignedTo: { id: string; jmeno: string } | null
  odhadovanaHodnota: number | null
  tagy: string[]
  vytvoreno: string
  _count: { notes: number }
}

interface User {
  id: string
  jmeno: string
}

interface Props {
  leady: Lead[]
  users: User[]
  novychCount: number
  currentUserId: string
  role: string
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  NOVY: 'Nový',
  KONTAKTOVAN: 'Kontaktován',
  KVALIFIKOVAN: 'Kvalifikován',
  PREVEDEN: 'Převeden',
  ZRUSEN: 'Zrušen',
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  NOVY: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  KONTAKTOVAN: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  KVALIFIKOVAN: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  PREVEDEN: 'bg-green-500/20 text-green-300 border border-green-500/30',
  ZRUSEN: 'bg-red-500/20 text-red-400 border border-red-500/30',
}

const ZDROJ_LABELS: Record<LeadZdroj, string> = {
  WEB_FORMULAR: 'Web',
  RUCNE: 'Ručně',
  IMPORT: 'Import',
}

const ZDROJ_COLORS: Record<LeadZdroj, string> = {
  WEB_FORMULAR: 'bg-cyan-500/20 text-cyan-300',
  RUCNE: 'bg-gray-500/20 text-gray-300',
  IMPORT: 'bg-orange-500/20 text-orange-300',
}

export default function LeadyPageClient({ leady, users, novychCount, currentUserId, role }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterZdroj, setFilterZdroj] = useState<string>('all')
  const [filterAssigned, setFilterAssigned] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)

  const filtered = useMemo(() => {
    return leady.filter(l => {
      if (filterStatus !== 'all' && l.status !== filterStatus) return false
      if (filterZdroj !== 'all' && l.zdroj !== filterZdroj) return false
      if (filterAssigned !== 'all') {
        if (filterAssigned === 'me' && l.assignedTo?.id !== currentUserId) return false
        if (filterAssigned !== 'me' && l.assignedTo?.id !== filterAssigned) return false
      }
      if (search) {
        const q = search.toLowerCase()
        return (
          l.jmeno.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.firma?.toLowerCase().includes(q) ||
          l.telefon?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [leady, search, filterStatus, filterZdroj, filterAssigned, currentUserId])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Leady</h1>
          {novychCount > 0 && (
            <p className="text-sm text-yellow-400 mt-0.5">{novychCount} nových leadů čeká na zpracování</p>
          )}
        </div>
        {role !== 'TECHNIK' && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#4CAF50] hover:bg-[#43A047] text-white rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Přidat lead
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Hledat jméno, email, firma..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 bg-[#1e2638] border border-white/20 rounded-lg text-sm text-white placeholder-white/50 focus:outline-none focus:border-[#4CAF50]/60 w-56"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 bg-[#1e2638] border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#4CAF50]/60"
        >
          <option value="all">Všechny statusy</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filterZdroj}
          onChange={e => setFilterZdroj(e.target.value)}
          className="px-3 py-1.5 bg-[#1e2638] border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#4CAF50]/60"
        >
          <option value="all">Všechny zdroje</option>
          {Object.entries(ZDROJ_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filterAssigned}
          onChange={e => setFilterAssigned(e.target.value)}
          className="px-3 py-1.5 bg-[#1e2638] border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#4CAF50]/60"
        >
          <option value="all">Všichni obchodníci</option>
          <option value="me">Moje leady</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.jmeno}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Kontakt</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">Email / Telefon</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">Zdroj</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden lg:table-cell">Přiřazen</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden xl:table-cell">Hodnota</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden lg:table-cell">Datum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-slate-500">
                  Žádné leady nenalezeny
                </td>
              </tr>
            ) : (
              filtered.map(lead => (
                <tr
                  key={lead.id}
                  onClick={() => router.push(`/leady/${lead.id}`)}
                  className="hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-slate-100">{lead.jmeno}</div>
                    {lead.firma && <div className="text-gray-500 dark:text-slate-400 text-xs mt-0.5">{lead.firma}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs hidden md:table-cell">
                    <div>{lead.email || '—'}</div>
                    {lead.telefon && <div className="mt-0.5">{lead.telefon}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status]}`}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${ZDROJ_COLORS[lead.zdroj]}`}>
                      {ZDROJ_LABELS[lead.zdroj]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-slate-300 hidden lg:table-cell">
                    {lead.assignedTo?.jmeno || <span className="text-gray-400 dark:text-slate-500 italic">nepřiřazen</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-slate-200 font-medium hidden xl:table-cell">
                    {lead.odhadovanaHodnota
                      ? `${formatKcPresne(lead.odhadovanaHodnota)}`
                      : <span className="text-gray-400 dark:text-slate-500">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs hidden lg:table-cell">
                    {formatDate(lead.vytvoreno)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="px-4 py-2 border-t border-gray-200 dark:border-slate-700 text-xs text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-900">
          {filtered.length} z {leady.length} leadů
        </div>
      </div>

      {/* Add Lead Modal */}
      {showModal && (
        <AddLeadModal
          users={users}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); router.refresh() }}
        />
      )}
    </div>
  )
}

function AddLeadModal({ users, onClose, onCreated }: {
  users: User[]
  onClose: () => void
  onCreated: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    jmeno: '', email: '', telefon: '', firma: '', zprava: '',
    assignedToId: '', odhadovanaHodnota: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await fetch('/api/leady', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          assignedToId: form.assignedToId || null,
          odhadovanaHodnota: form.odhadovanaHodnota || null,
        }),
      })
      onCreated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#141922] border border-white/10 rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">Nový lead</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/65 mb-1">Jméno *</label>
              <input
                required
                value={form.jmeno}
                onChange={e => setForm(f => ({ ...f, jmeno: e.target.value }))}
                className="w-full px-3 py-2 bg-[#1e2638] border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#4CAF50]/60"
              />
            </div>
            <div>
              <label className="block text-xs text-white/65 mb-1">Firma</label>
              <input
                value={form.firma}
                onChange={e => setForm(f => ({ ...f, firma: e.target.value }))}
                className="w-full px-3 py-2 bg-[#1e2638] border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#4CAF50]/60"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/65 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 bg-[#1e2638] border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#4CAF50]/60"
              />
            </div>
            <div>
              <label className="block text-xs text-white/65 mb-1">Telefon</label>
              <input
                value={form.telefon}
                onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))}
                className="w-full px-3 py-2 bg-[#1e2638] border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#4CAF50]/60"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/65 mb-1">Zpráva / poptávka</label>
            <textarea
              rows={3}
              value={form.zprava}
              onChange={e => setForm(f => ({ ...f, zprava: e.target.value }))}
              className="w-full px-3 py-2 bg-[#1e2638] border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#4CAF50]/60 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/65 mb-1">Přiřadit obchodníkovi</label>
              <select
                value={form.assignedToId}
                onChange={e => setForm(f => ({ ...f, assignedToId: e.target.value }))}
                className="w-full px-3 py-2 bg-[#1e2638] border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#4CAF50]/60"
              >
                <option value="">Nepřiřazen</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.jmeno}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/65 mb-1">Odh. hodnota (Kč)</label>
              <input
                type="number"
                value={form.odhadovanaHodnota}
                onChange={e => setForm(f => ({ ...f, odhadovanaHodnota: e.target.value }))}
                className="w-full px-3 py-2 bg-[#1e2638] border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#4CAF50]/60"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-white/65 hover:text-white transition-colors">
              Zrušit
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[#4CAF50] hover:bg-[#43A047] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Ukládám...' : 'Vytvořit lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
