'use client'

import { useState, useMemo, useId } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import EmptyState from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { LeadZdroj, LeadStatus } from '@prisma/client'
import { formatDate, formatKcPresne } from '@/lib/format'
import FilterDropdown from '@/components/ui/FilterDropdown'
import { confirmDialog } from '@/components/ui/confirm'
import { sluzbaLabel } from '@/lib/leadService'

interface Lead {
  id: string
  jmeno: string
  email: string | null
  telefon: string | null
  firma: string | null
  zdroj: LeadZdroj
  status: LeadStatus
  sluzba: string | null
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
  canEdit: boolean
  canDelete: boolean
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  NOVY: 'Nový',
  KONTAKTOVAN: 'Kontaktován',
  KVALIFIKOVAN: 'Kvalifikován',
  PREVEDEN: 'Převeden',
  ZRUSEN: 'Zamítnut',
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  NOVY: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
  KONTAKTOVAN: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30',
  KVALIFIKOVAN: 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30',
  PREVEDEN: 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30',
  ZRUSEN: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
}

const ZDROJ_LABELS: Record<LeadZdroj, string> = {
  WEB_FORMULAR: 'Web',
  RUCNE: 'Ručně',
  IMPORT: 'Import',
}

const ZDROJ_COLORS: Record<LeadZdroj, string> = {
  WEB_FORMULAR: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
  RUCNE: 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-300',
  IMPORT: 'bg-orange-50 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
}

export default function LeadyPageClient({ leady, users, novychCount, currentUserId, canEdit, canDelete }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterZdroj, setFilterZdroj] = useState<string>('all')
  const [filterAssigned, setFilterAssigned] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [deleting, setDeleting] = useState(false)

  const statusOptions = [
    { value: 'all', label: 'Všechny statusy' },
    ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v })),
  ]
  const zdrojOptions = [
    { value: 'all', label: 'Všechny zdroje' },
    ...Object.entries(ZDROJ_LABELS).map(([k, v]) => ({ value: k, label: v })),
  ]
  const assignedOptions = [
    { value: 'all', label: 'Všichni obchodníci' },
    { value: 'me', label: 'Moje leady' },
    ...users.map(u => ({ value: u.id, label: u.jmeno })),
  ]

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

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const vsechnyVybrane = filtered.length > 0 && filtered.every(l => selectedSet.has(l.id))

  function toggleLead(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleVse() {
    setSelected(vsechnyVybrane ? [] : filtered.map(l => l.id))
  }

  async function smazatVybrane() {
    const ok = await confirmDialog(
      `Smazat ${selected.length} ${selected.length === 1 ? 'lead' : selected.length < 5 ? 'leady' : 'leadů'}? Akci nelze vrátit zpět.`,
      { title: 'Smazat leady', confirmLabel: 'Smazat', danger: true }
    )
    if (!ok) return
    setDeleting(true)
    const vysledky = await Promise.all(
      selected.map(id => fetch(`/api/leady/${id}`, { method: 'DELETE' }).then(r => r.ok).catch(() => false))
    )
    setDeleting(false)
    const smazano = vysledky.filter(Boolean).length
    const selhalo = vysledky.length - smazano
    if (smazano > 0) toast.success(`Smazáno ${smazano} leadů`)
    if (selhalo > 0) toast.error(`${selhalo} leadů se nepodařilo smazat`)
    setSelected([])
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leady"
        description={novychCount > 0 ? <span className="text-amber-700 dark:text-yellow-400">{novychCount} nových leadů čeká na zpracování</span> : undefined}
        actions={canEdit && <Button onClick={() => setShowModal(true)}>+ Přidat lead</Button>}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Hledat jméno, email, firma..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#4CAF50]/60 w-56"
        />
        <FilterDropdown value={filterStatus} onChange={setFilterStatus} options={statusOptions} />
        <FilterDropdown value={filterZdroj} onChange={setFilterZdroj} options={zdrojOptions} />
        <FilterDropdown value={filterAssigned} onChange={setFilterAssigned} options={assignedOptions} />
      </div>

      {/* Hromadné akce */}
      {canDelete && selected.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[#4CAF50]/10 border border-[#4CAF50]/30 rounded-lg">
          <span className="text-sm text-gray-700 dark:text-slate-200">Vybráno {selected.length}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected([])}
              className="px-3 py-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Zrušit výběr
            </button>
            <button
              onClick={smazatVybrane}
              disabled={deleting}
              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {deleting ? 'Mažu...' : 'Smazat vybrané'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
            <tr>
              {canDelete && (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={vsechnyVybrane}
                    onChange={toggleVse}
                    aria-label="Vybrat všechny leady"
                    className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 accent-[#4CAF50] cursor-pointer"
                  />
                </th>
              )}
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Kontakt</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">Poptávka</th>
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
                <td colSpan={canDelete ? 9 : 8}>
                  {leady.length === 0 ? (
                    <EmptyState
                      compact
                      title="Zatím žádné leady"
                      description="Poptávky z webového formuláře se tu objeví samy (Nastavení → API a webhooky). Ruční lead přidáte tlačítkem."
                      actionLabel={canEdit ? '+ Přidat lead' : undefined}
                      onAction={() => setShowModal(true)}
                    />
                  ) : (
                    <EmptyState
                      compact
                      title="Nic neodpovídá filtru"
                      actionLabel="Zrušit filtry"
                      onAction={() => { setSearch(''); setFilterStatus('all'); setFilterZdroj('all'); setFilterAssigned('all') }}
                    />
                  )}
                </td>
              </tr>
            ) : (
              filtered.map(lead => (
                <tr
                  key={lead.id}
                  onClick={() => router.push(`/leady/${lead.id}`)}
                  className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors ${selectedSet.has(lead.id) ? 'bg-[#4CAF50]/5' : ''}`}
                >
                  {canDelete && (
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(lead.id)}
                        onChange={() => toggleLead(lead.id)}
                        aria-label={`Vybrat lead ${lead.jmeno}`}
                        className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 accent-[#4CAF50] cursor-pointer"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-slate-100">{lead.jmeno}</div>
                    {lead.firma && <div className="text-gray-500 dark:text-slate-400 text-xs mt-0.5">{lead.firma}</div>}
                    {/* Mobil: řádek jako karta — poptávka, telefon, datum */}
                    <div className="md:hidden text-xs text-gray-500 dark:text-slate-400 mt-1 space-y-0.5">
                      {sluzbaLabel(lead.sluzba) && <div>{sluzbaLabel(lead.sluzba)}</div>}
                      <div>{[lead.telefon || lead.email, formatDate(lead.vytvoreno)].filter(Boolean).join(' · ')}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {sluzbaLabel(lead.sluzba)
                      ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300">{sluzbaLabel(lead.sluzba)}</span>
                      : <span className="text-gray-400 dark:text-slate-500 text-xs">—</span>}
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
          onCreated={id => { setShowModal(false); router.refresh(); router.push(`/leady/${id}`) }}
        />
      )}
    </div>
  )
}

function AddLeadModal({ users, onClose, onCreated }: {
  users: User[]
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const formId = useId()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    jmeno: '', email: '', telefon: '', firma: '', zprava: '',
    assignedToId: '', odhadovanaHodnota: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/leady', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          assignedToId: form.assignedToId || null,
          odhadovanaHodnota: form.odhadovanaHodnota.replace(/\s/g, '').replace(',', '.') || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        toast.error(body?.error ?? 'Lead se nepodařilo vytvořit')
        return
      }
      const lead = await res.json()
      toast.success('Lead vytvořen')
      // Rovnou do detailu — tam se lead dál kvalifikuje / převádí
      onCreated(lead.id)
    } finally {
      setSaving(false)
    }
  }

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <Dialog
      open
      onClose={onClose}
      title="Nový lead"
      size="lg"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Zrušit</Button>
        <Button type="submit" form={formId} loading={saving}>Vytvořit lead</Button>
      </>}
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Jméno" required>
            <Input required value={form.jmeno} onChange={e => set('jmeno', e.target.value)} autoComplete="name" />
          </Field>
          <Field label="Firma">
            <Input value={form.firma} onChange={e => set('firma', e.target.value)} autoComplete="organization" />
          </Field>
          <Field label="E-mail">
            <Input kind="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </Field>
          <Field label="Telefon">
            <Input kind="tel" value={form.telefon} onChange={e => set('telefon', e.target.value)} />
          </Field>
        </div>
        <Field label="Zpráva / poptávka">
          <Textarea rows={3} value={form.zprava} onChange={e => set('zprava', e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Přiřadit obchodníkovi">
            <Select value={form.assignedToId} onChange={e => set('assignedToId', e.target.value)}>
              <option value="">Nepřiřazen</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.jmeno}</option>)}
            </Select>
          </Field>
          <Field label="Odh. hodnota (Kč)">
            <Input kind="castka" value={form.odhadovanaHodnota} onChange={e => set('odhadovanaHodnota', e.target.value)} />
          </Field>
        </div>
      </form>
    </Dialog>
  )
}
