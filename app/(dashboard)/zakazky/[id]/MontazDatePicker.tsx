'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

interface EtapaTermin {
  id: string
  cislo: number
  nazev: string | null
  montazOd: string | null
  montazDo: string | null
}

interface Props {
  zakazkaId: string
  montazOd: string | null
  montazDo: string | null
  canEdit: boolean
  etapy?: EtapaTermin[]
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function fmtMontaz(od: string | null, doo: string | null): string {
  if (!od) return ''
  const odD = new Date(od)
  const locale = 'cs-CZ'
  const datePart = odD.toLocaleDateString(locale, { day: 'numeric', month: 'numeric', year: 'numeric' })
  if (!doo) return datePart
  const dooD = new Date(doo)
  const sameDay = odD.toDateString() === dooD.toDateString()
  if (sameDay) return datePart
  const dateDoo = dooD.toLocaleDateString(locale, { day: 'numeric', month: 'numeric', year: 'numeric' })
  return `${datePart} – ${dateDoo}`
}

// Single-row inline editor for zakazka or etapa termín
function TerminEditor({
  label,
  initialOd,
  initialDo,
  onSave,
  onClear,
  onCancel,
  canClear,
}: {
  label?: string
  initialOd: string
  initialDo: string
  onSave: (od: string, doo: string) => Promise<void>
  onClear: () => Promise<void>
  onCancel: () => void
  canClear: boolean
}) {
  const [od, setOd] = useState(initialOd)
  const [doo, setDoo] = useState(initialDo)
  const [saving, setSaving] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">{label}:</span>}
      <div className="flex items-center gap-1.5">
        <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <input type="date" value={od} onChange={e => setOd(e.target.value)}
          className="border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-400"
          style={{ fontSize: 14 }}
        />
        <span className="text-xs text-gray-400">–</span>
        <input type="date" value={doo} onChange={e => setDoo(e.target.value)} min={od}
          className="border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-400"
          style={{ fontSize: 14 }}
        />
      </div>
      <div className="flex items-center gap-1">
        <button onClick={async () => { setSaving(true); try { await onSave(od, doo) } finally { setSaving(false) } }}
          disabled={saving || !od}
          className="px-2.5 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50 transition-colors">
          {saving ? 'Ukládám…' : 'Uložit'}
        </button>
        {canClear && (
          <button onClick={async () => { setSaving(true); try { await onClear() } finally { setSaving(false) } }}
            disabled={saving}
            className="px-2.5 py-1 text-xs text-gray-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-50">
            Zrušit termín
          </button>
        )}
        <button onClick={onCancel} className="px-2.5 py-1 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600">✕</button>
      </div>
    </div>
  )
}

// Single display chip for a termín
function TerminChip({ label, termin, canEdit, onEdit }: { label?: string; termin: string; canEdit: boolean; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-lg">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {label ? `${label}: ` : ''}{termin}
      </span>
      {canEdit && (
        <button onClick={onEdit} className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 underline">
          upravit
        </button>
      )}
    </div>
  )
}

export default function MontazDatePicker({ zakazkaId, montazOd, montazDo, canEdit, etapy = [] }: Props) {
  const router = useRouter()
  const [editingMain, setEditingMain] = useState(false)
  const [editingEtapaId, setEditingEtapaId] = useState<string | null>(null)

  const hasMultipleEtapy = etapy.length >= 2

  // Save zakázka termín
  async function saveMain(od: string, doo: string) {
    const res = await api.patch(`/api/zakazky/${zakazkaId}`, {
      montazOd: od ? new Date(od).toISOString() : null,
      montazDo: doo ? new Date(doo).toISOString() : null,
    }, { errorMessage: 'Termín montáže se nepodařilo uložit.' })
    if (res.ok) router.refresh()
    setEditingMain(false)
  }

  async function clearMain() {
    const res = await api.patch(`/api/zakazky/${zakazkaId}`,
      { montazOd: null, montazDo: null },
      { errorMessage: 'Termín montáže se nepodařilo smazat.' })
    if (res.ok) router.refresh()
    setEditingMain(false)
  }

  // Save etapa termín
  async function saveEtapa(etapaId: string, od: string, doo: string) {
    const res = await api.patch(`/api/zakazky/${zakazkaId}/etapy/${etapaId}`, {
      montazOd: od ? new Date(od).toISOString() : null,
      montazDo: doo ? new Date(doo).toISOString() : null,
    }, { errorMessage: 'Termín etapy se nepodařilo uložit.' })
    if (res.ok) router.refresh()
    setEditingEtapaId(null)
  }

  async function clearEtapa(etapaId: string) {
    const res = await api.patch(`/api/zakazky/${zakazkaId}/etapy/${etapaId}`,
      { montazOd: null, montazDo: null },
      { errorMessage: 'Termín etapy se nepodařilo smazat.' })
    if (res.ok) router.refresh()
    setEditingEtapaId(null)
  }

  // ── Single etapa or no etapy: show main zakázka termín only ──────────────
  if (!hasMultipleEtapy) {
    const label = fmtMontaz(montazOd, montazDo)

    if (editingMain) {
      return (
        <TerminEditor
          initialOd={toLocalInput(montazOd)}
          initialDo={toLocalInput(montazDo)}
          onSave={saveMain}
          onClear={clearMain}
          onCancel={() => setEditingMain(false)}
          canClear={!!montazOd}
        />
      )
    }

    if (label) {
      return <TerminChip termin={label} canEdit={canEdit} onEdit={() => setEditingMain(true)} />
    }

    if (!canEdit) return null

    return (
      <div>
        <button onClick={() => setEditingMain(true)}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          + Nastavit termín montáže
        </button>
      </div>
    )
  }

  // ── Multiple etapy: show per-etapa termíny ────────────────────────────────
  return (
    <div className="space-y-1.5">
      {etapy.map(e => {
        const etapaLabel = e.nazev ? `Etapa ${e.cislo} — ${e.nazev}` : `Etapa ${e.cislo}`
        const termin = fmtMontaz(e.montazOd, e.montazDo)

        if (editingEtapaId === e.id) {
          return (
            <TerminEditor
              key={e.id}
              label={etapaLabel}
              initialOd={toLocalInput(e.montazOd)}
              initialDo={toLocalInput(e.montazDo)}
              onSave={(od, doo) => saveEtapa(e.id, od, doo)}
              onClear={() => clearEtapa(e.id)}
              onCancel={() => setEditingEtapaId(null)}
              canClear={!!e.montazOd}
            />
          )
        }

        if (termin) {
          return (
            <TerminChip
              key={e.id}
              label={etapaLabel}
              termin={termin}
              canEdit={canEdit}
              onEdit={() => setEditingEtapaId(e.id)}
            />
          )
        }

        if (!canEdit) return null

        return (
          <button
            key={e.id}
            onClick={() => setEditingEtapaId(e.id)}
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            + {etapaLabel} — nastavit termín
          </button>
        )
      })}
    </div>
  )
}
