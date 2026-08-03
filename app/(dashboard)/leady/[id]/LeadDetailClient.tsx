'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { LeadZdroj, LeadStatus, Technologie } from '@prisma/client'
import { formatDate, formatKcPresne } from '@/lib/format'
import { confirmDialog } from '@/components/ui/confirm'
import { leadPredmet, sluzbaLabel, sluzbaToTechnologie } from '@/lib/leadService'

interface LeadNote {
  id: string
  text: string
  vytvoreno: string
  user: { id: string; jmeno: string; avatar: string | null }
}

interface Lead {
  id: string
  jmeno: string
  email: string | null
  telefon: string | null
  firma: string | null
  zdroj: LeadZdroj
  status: LeadStatus
  zprava: string | null
  sluzba: string | null
  zdrojFormulare: string | null
  strankaUrl: string | null
  prilohy: string | null
  objednavka: string | null
  assignedTo: { id: string; jmeno: string; email: string; avatar: string | null } | null
  odhadovanaHodnota: number | null
  tagy: string[]
  duvodZruseni: string | null
  vytvoreno: string
  updatedAt: string
  notes: LeadNote[]
  prevedenNaOp: {
    id: string
    kod: string | null
    predmet: string | null
    stav: string
    vytvoreno: string
    client: { id: string; jmeno: string; prijmeni: string }
  } | null
}

interface Props {
  lead: Lead
  users: { id: string; jmeno: string }[]
  role: string
}

const PIPELINE: { key: LeadStatus; label: string }[] = [
  { key: 'NOVY', label: 'Nový' },
  { key: 'KONTAKTOVAN', label: 'Kontaktován' },
  { key: 'KVALIFIKOVAN', label: 'Kvalifikován' },
  { key: 'PREVEDEN', label: 'Převeden' },
]

const STATUS_LABELS: Record<LeadStatus, string> = {
  NOVY: 'Nový',
  KONTAKTOVAN: 'Kontaktován',
  KVALIFIKOVAN: 'Kvalifikován',
  PREVEDEN: 'Převeden',
  ZRUSEN: 'Zrušen',
}

const ZDROJ_LABELS: Record<LeadZdroj, string> = {
  WEB_FORMULAR: 'Web formulář',
  RUCNE: 'Ručně',
  IMPORT: 'Import',
}

const TECH_OPTIONS: { value: Technologie; label: string }[] = [
  { value: 'KLIMA', label: 'Klimatizace' },
  { value: 'TEPELNE_CERPADLO', label: 'Tepelné čerpadlo' },
  { value: 'REKUPERACE', label: 'Rekuperace' },
  { value: 'PODLAHOVE_TOPENI', label: 'Podlahové topení' },
  { value: 'VZDUCHOTECHNIKA', label: 'Vzduchotechnika' },
  { value: 'JINE', label: 'Jiné' },
]

export default function LeadDetailClient({ lead: initialLead, users, role }: Props) {
  const router = useRouter()
  const [lead, setLead] = useState(initialLead)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)

  const isClosed = lead.status === 'PREVEDEN' || lead.status === 'ZRUSEN'
  const canEdit = role !== 'TECHNIK'
  const canDelete = role === 'ADMIN'

  async function patch(data: Record<string, unknown>) {
    const res = await fetch(`/api/leady/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      setLead(prev => ({ ...prev, ...updated }))
      // Seznam leadů drží router cache — bez refreshe by ukazoval starý stav.
      router.refresh()
    } else {
      const body = await res.json().catch(() => null)
      toast.error(body?.error ?? 'Uložení se nezdařilo')
    }
  }

  async function handleDelete() {
    const ok = await confirmDialog(
      lead.prevedenNaOp
        ? `Smazat lead ${lead.jmeno}? Vytvořený obchodní případ ${lead.prevedenNaOp.kod ?? ''} i klient zůstanou.`
        : `Smazat lead ${lead.jmeno}? Akci nelze vrátit zpět.`,
      { title: 'Smazat lead', confirmLabel: 'Smazat', danger: true }
    )
    if (!ok) return
    const res = await fetch(`/api/leady/${lead.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      toast.error(body?.error ?? 'Smazání se nezdařilo')
      return
    }
    toast.success('Lead smazán')
    router.push('/leady')
    router.refresh()
  }

  async function handleReopen() {
    const res = await fetch(`/api/leady/${lead.id}/reopen`, { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      toast.error(body?.error ?? 'Znovuotevření se nezdařilo')
      return
    }
    const updated = await res.json()
    setLead(prev => ({ ...prev, ...updated }))
    toast.success('Lead vrácen do pipeline')
    router.refresh()
  }

  async function setStatus(status: LeadStatus) {
    if (!canEdit || isClosed) return
    setSavingStatus(true)
    await patch({ status })
    setSavingStatus(false)
  }

  async function addNote() {
    if (!noteText.trim()) return
    setSavingNote(true)
    const res = await fetch(`/api/leady/${lead.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: noteText }),
    })
    if (res.ok) {
      const note = await res.json()
      setLead(prev => ({ ...prev, notes: [...prev.notes, note] }))
      setNoteText('')
    } else {
      const body = await res.json().catch(() => null)
      toast.error(body?.error ?? 'Poznámku se nepodařilo uložit')
    }
    setSavingNote(false)
  }

  async function addTag() {
    const tag = newTag.trim()
    if (!tag || lead.tagy.includes(tag)) { setNewTag(''); return }
    await patch({ tagy: [...lead.tagy, tag] })
    setNewTag('')
  }

  async function removeTag(tag: string) {
    await patch({ tagy: lead.tagy.filter(t => t !== tag) })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Back */}
      <Link href="/leady" className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Zpět na leady
      </Link>

      {/* 1. Pipeline status bar */}
      {lead.status !== 'ZRUSEN' ? (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-1">
            {PIPELINE.map((step, idx) => {
              const steps = ['NOVY', 'KONTAKTOVAN', 'KVALIFIKOVAN', 'PREVEDEN']
              const currentIdx = steps.indexOf(lead.status)
              const isDone = idx <= currentIdx
              const isActive = lead.status === step.key
              return (
                <div key={step.key} className="flex items-center flex-1">
                  <button
                    onClick={() => {
                      if (!canEdit || isClosed) return
                      if (step.key === 'PREVEDEN') {
                        setShowConvertModal(true)
                      } else {
                        setStatus(step.key)
                      }
                    }}
                    disabled={isClosed || !canEdit || savingStatus}
                    className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-colors text-center
                      ${isActive ? 'bg-[#4CAF50] text-white' : isDone ? 'bg-[#4CAF50]/20 text-[#3d8b40] dark:text-[#4CAF50]' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600 hover:text-gray-700 dark:hover:text-slate-200'}
                      ${isClosed || !canEdit ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    {step.key === 'PREVEDEN' && !isClosed && canEdit ? (
                      <span className="flex items-center justify-center gap-1">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4" />
                        </svg>
                        {step.label}
                      </span>
                    ) : step.label}
                  </button>
                  {idx < PIPELINE.length - 1 && (
                    <div className={`h-px w-2 flex-shrink-0 ${isDone && idx < currentIdx ? 'bg-[#4CAF50]/50' : 'bg-gray-200 dark:bg-slate-700'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="text-red-700 dark:text-red-300 font-medium text-sm">Lead zamítnut</p>
            {lead.duvodZruseni && <p className="text-red-600 dark:text-red-400/70 text-xs mt-0.5">{lead.duvodZruseni}</p>}
          </div>
          {canEdit && (
            <button
              onClick={handleReopen}
              className="px-3 py-1.5 text-xs rounded-lg border border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex-shrink-0"
            >
              Znovu otevřít
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* 2. Kontaktní karta */}
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{lead.jmeno}</h1>
                {lead.firma && <p className="text-gray-600 dark:text-slate-400 text-sm">{lead.firma}</p>}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                lead.zdroj === 'WEB_FORMULAR' ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300' :
                lead.zdroj === 'IMPORT' ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300' :
                'bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-300'
              }`}>
                {ZDROJ_LABELS[lead.zdroj]}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {lead.telefon && (
                <a
                  href={`tel:${lead.telefon}`}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {lead.telefon}
                </a>
              )}
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {lead.email}
                </a>
              )}
            </div>
          </div>

          {/* 3. Poptávka — služba a text od klienta */}
          {(lead.zprava || sluzbaLabel(lead.sluzba) || lead.objednavka || lead.prilohy) && (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Poptávka</h3>
              {(sluzbaLabel(lead.sluzba) || lead.objednavka) && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {sluzbaLabel(lead.sluzba) && (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-[#4CAF50]/10 text-[#3d8b40] dark:text-[#4CAF50] border border-[#4CAF50]/30">
                      {sluzbaLabel(lead.sluzba)}
                    </span>
                  )}
                  {lead.objednavka && (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
                      Objednávka: {lead.objednavka}
                    </span>
                  )}
                </div>
              )}
              {lead.zprava
                ? <p className="text-gray-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{lead.zprava}</p>
                : <p className="text-gray-400 dark:text-slate-500 text-sm">Klient nepřipojil žádnou zprávu</p>}
              {lead.prilohy && (
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-3">Přílohy: {lead.prilohy}</p>
              )}
            </div>
          )}

          {/* 7. Interní poznámky */}
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-4">Interní poznámky</h3>
            <div className="space-y-3 mb-4">
              {lead.notes.length === 0 && (
                <p className="text-gray-400 dark:text-slate-500 text-sm">Zatím žádné poznámky</p>
              )}
              {lead.notes.map(note => (
                <div key={note.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#4CAF50]/20 flex items-center justify-center flex-shrink-0 text-xs text-[#4CAF50] font-medium">
                    {note.user.jmeno.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-gray-700 dark:text-slate-200">{note.user.jmeno}</span>
                      <span className="text-xs text-gray-400 dark:text-slate-500">
                        {new Date(note.vytvoreno).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{note.text}</p>
                  </div>
                </div>
              ))}
            </div>
            {canEdit && !isClosed && (
              <div className="flex gap-2">
                <textarea
                  rows={2}
                  placeholder="Přidat poznámku..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote() }}
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4CAF50]/40 resize-none"
                />
                <button
                  onClick={addNote}
                  disabled={savingNote || !noteText.trim()}
                  className="px-3 py-2 bg-[#4CAF50] hover:bg-[#43A047] text-white rounded-lg text-sm transition-colors disabled:opacity-40 self-end"
                >
                  {savingNote ? '...' : 'Přidat'}
                </button>
              </div>
            )}
          </div>

          {/* 10. Převedeno na OP */}
          {lead.prevedenNaOp && (
            <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-green-700 dark:text-green-400/80 uppercase tracking-wide mb-3">Převeden na obchodní případ</h3>
              <Link
                href={`/deals/${lead.prevedenNaOp.id}`}
                className="flex items-center justify-between hover:bg-green-100/50 dark:hover:bg-green-500/5 rounded-lg p-2 -m-2 transition-colors group"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white group-hover:text-green-700 dark:group-hover:text-green-300 transition-colors">
                    {lead.prevedenNaOp.kod} — {lead.prevedenNaOp.predmet || lead.prevedenNaOp.client.jmeno + ' ' + lead.prevedenNaOp.client.prijmeni}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    {formatDate(lead.prevedenNaOp.vytvoreno)}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-400 dark:text-slate-500 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* 4. Přiřazený obchodník */}
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Přiřazený obchodník</h3>
            {canEdit && !isClosed ? (
              <select
                value={lead.assignedTo?.id || ''}
                onChange={e => patch({ assignedToId: e.target.value || null })}
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4CAF50]/40"
              >
                <option value="">Nepřiřazen</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.jmeno}</option>)}
              </select>
            ) : (
              <p className="text-sm text-gray-700 dark:text-slate-200">{lead.assignedTo?.jmeno || <span className="text-gray-400 dark:text-slate-500 italic">Nepřiřazen</span>}</p>
            )}
          </div>

          {/* 6. Odhadovaná hodnota */}
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Odhadovaná hodnota</h3>
            {canEdit && !isClosed ? (
              <input
                type="number"
                defaultValue={lead.odhadovanaHodnota ?? ''}
                onBlur={e => patch({ odhadovanaHodnota: e.target.value || null })}
                placeholder="0"
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4CAF50]/40"
              />
            ) : (
              <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">
                {lead.odhadovanaHodnota ? `${formatKcPresne(lead.odhadovanaHodnota)}` : <span className="font-normal text-gray-400 dark:text-slate-500">—</span>}
              </p>
            )}
          </div>

          {/* 8. Tagy */}
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Štítky</h3>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {lead.tagy.length === 0 && <p className="text-gray-400 dark:text-slate-500 text-xs">Žádné štítky</p>}
              {lead.tagy.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#4CAF50]/10 text-[#3d8b40] dark:text-[#4CAF50] border border-[#4CAF50]/30 rounded-full text-xs">
                  {tag}
                  {canEdit && !isClosed && (
                    <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </span>
              ))}
            </div>
            {canEdit && !isClosed && (
              <div className="flex gap-1">
                <input
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTag()}
                  placeholder="Nový štítek..."
                  className="flex-1 px-2 py-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#4CAF50]/50"
                />
                <button onClick={addTag} className="px-2 py-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-600 rounded-lg text-xs transition-colors">
                  +
                </button>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Informace</h3>
            <div className="space-y-2 text-xs divide-y divide-gray-100 dark:divide-slate-700">
              <div className="flex justify-between py-1 first:pt-0">
                <span className="text-gray-500 dark:text-slate-400">Vytvořen</span>
                <span className="text-gray-800 dark:text-slate-200 font-medium">{formatDate(lead.vytvoreno)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500 dark:text-slate-400">Aktualizován</span>
                <span className="text-gray-800 dark:text-slate-200 font-medium">{formatDate(lead.updatedAt)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500 dark:text-slate-400">Zdroj</span>
                <span className="text-gray-800 dark:text-slate-200 font-medium">{ZDROJ_LABELS[lead.zdroj]}</span>
              </div>
              {lead.zdrojFormulare && (
                <div className="flex justify-between gap-2 py-1">
                  <span className="text-gray-500 dark:text-slate-400 flex-shrink-0">Formulář</span>
                  <span className="text-gray-800 dark:text-slate-200 font-medium truncate">{lead.zdrojFormulare}</span>
                </div>
              )}
              {lead.strankaUrl && (
                <div className="flex justify-between gap-2 py-1">
                  <span className="text-gray-500 dark:text-slate-400 flex-shrink-0">Stránka</span>
                  <a
                    href={lead.strankaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#3d8b40] dark:text-[#4CAF50] font-medium truncate hover:underline"
                    title={lead.strankaUrl}
                  >
                    {lead.strankaUrl.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-gray-500 dark:text-slate-400">Status</span>
                <span className="text-gray-800 dark:text-slate-200 font-medium">{STATUS_LABELS[lead.status]}</span>
              </div>
            </div>
          </div>

          {/* 9 + 10. Akce */}
          <div className="space-y-2">
            {canEdit && !isClosed && (
              <button
                onClick={() => setShowConvertModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#4CAF50] hover:bg-[#43A047] text-white rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Převést na OP
              </button>
            )}
            {canEdit && !isClosed && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-500/10 border border-gray-200 dark:border-slate-600 hover:border-red-300 dark:hover:border-red-500/30 text-gray-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 rounded-lg text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Zamítnout
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Smazat lead
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Convert Modal */}
      {showConvertModal && (
        <ConvertModal
          lead={lead}
          onClose={() => setShowConvertModal(false)}
          onConverted={(dealId) => {
            setShowConvertModal(false)
            setLead(prev => ({ ...prev, status: 'PREVEDEN' }))
            // Refresh musí být před navigací — jinak zůstane v router cache
            // seznam i detail se starým statusem "Nový".
            router.refresh()
            router.push(`/deals/${dealId}`)
          }}
        />
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <CancelModal
          leadId={lead.id}
          onClose={() => setShowCancelModal(false)}
          onCancelled={(duvod) => {
            setShowCancelModal(false)
            setLead(prev => ({ ...prev, status: 'ZRUSEN', duvodZruseni: duvod || null }))
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function ConvertModal({ lead, onClose, onConverted }: {
  lead: Lead
  onClose: () => void
  onConverted: (dealId: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const [technologie, setTechnologie] = useState<Technologie>(sluzbaToTechnologie(lead.sluzba))
  const [predmet, setPredmet] = useState(leadPredmet(lead))

  async function handleConvert() {
    setSaving(true)
    const res = await fetch(`/api/leady/${lead.id}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ technologie, predmet }),
    })
    if (res.ok) {
      const data = await res.json()
      toast.success('Obchodní případ vytvořen')
      onConverted(data.dealId)
    } else {
      const body = await res.json().catch(() => null)
      toast.error(body?.error ?? 'Převod se nezdařil')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#141922] border border-white/10 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">Převést na obchodní případ</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-white/8 border border-white/15 rounded-lg p-3 text-sm">
            <p className="text-white/65 text-xs mb-1">Bude vytvořen</p>
            <p className="text-white">Nový klient: <span className="text-[#4CAF50]">{lead.jmeno}</span></p>
            {lead.email && <p className="text-white/65 text-xs mt-0.5">{lead.email}</p>}
            {lead.telefon && <p className="text-white/65 text-xs">{lead.telefon}</p>}
          </div>
          <div>
            <label className="block text-xs text-white/65 mb-1">Technologie *</label>
            <select
              value={technologie}
              onChange={e => setTechnologie(e.target.value as Technologie)}
              className="w-full px-3 py-2 bg-[#1e2638] border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#4CAF50]/60"
            >
              {TECH_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/65 mb-1">Předmět OP</label>
            <input
              value={predmet}
              onChange={e => setPredmet(e.target.value)}
              className="w-full px-3 py-2 bg-[#1e2638] border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#4CAF50]/60"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-white/65 hover:text-white transition-colors">
              Zrušit
            </button>
            <button
              onClick={handleConvert}
              disabled={saving}
              className="px-4 py-2 bg-[#4CAF50] hover:bg-[#43A047] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Vytvářím...' : 'Vytvořit OP'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CancelModal({ leadId, onClose, onCancelled }: {
  leadId: string
  onClose: () => void
  onCancelled: (duvod: string) => void
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleCancel() {
    setSaving(true)
    const res = await fetch(`/api/leady/${leadId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duvodZruseni: reason }),
    })
    if (res.ok) {
      toast.success('Lead zamítnut')
      onCancelled(reason.trim())
    } else {
      const body = await res.json().catch(() => null)
      toast.error(body?.error ?? 'Zamítnutí se nezdařilo')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#141922] border border-white/10 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">Zamítnout lead</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-white/65 mb-1">Důvod zamítnutí (volitelné)</label>
            <textarea
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Proč se lead zamítá?"
              className="w-full px-3 py-2 bg-[#1e2638] border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-red-500/50 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-white/65 hover:text-white transition-colors">
              Zpět
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Ukládám...' : 'Zamítnout lead'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
