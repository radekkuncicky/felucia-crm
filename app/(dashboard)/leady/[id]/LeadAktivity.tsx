'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { formatDate, formatDateTime } from '@/lib/format'
import { confirmDialog } from '@/components/ui/confirm'
import { ActivityTypeIcon } from '@/components/ui/ActivityTypeIcon'
import DokoncitAktivituModal from '@/components/DokoncitAktivituModal'

/**
 * Aktivity na leadu — jen hovory a e-maily. Stejný model Activity jako u OP
 * (leadId místo dealId), takže fungují připomínky, kalendář i „Co mám dělat“.
 * Při převodu leadu na OP se aktivity přesunou na nový OP.
 */

export interface LeadActivity {
  id: string
  typ: string
  popis: string | null
  vysledek: string | null
  datum: string
  cas: string | null
  stav: 'PLANOVANA' | 'DOKONCENA' | 'ZRUSENA'
  userJmeno: string | null
  resitelId: string | null
  resitelJmeno: string | null
  reminderAt: string | null
}

const TYPY = [
  { value: 'HOVOR', label: 'Hovor' },
  { value: 'EMAIL', label: 'Email' },
]
const TYP_LABEL: Record<string, string> = { HOVOR: 'Hovor', EMAIL: 'Email' }

const STAV = {
  PLANOVANA: { label: 'Plánovaná', cls: 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300' },
  DOKONCENA: { label: 'Hotovo', cls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
  ZRUSENA: { label: 'Zrušena', cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' },
} as const

const inp = 'w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4CAF50]/40'

function dnes(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromApi(a: any): LeadActivity {
  return {
    id: a.id,
    typ: a.typ,
    popis: a.popis ?? null,
    vysledek: a.vysledek ?? null,
    datum: new Date(a.datum).toISOString().split('T')[0],
    cas: a.cas ?? null,
    stav: a.stav ?? 'PLANOVANA',
    userJmeno: a.user?.jmeno ?? null,
    resitelId: a.resitelId ?? null,
    resitelJmeno: a.resitel?.jmeno ?? null,
    reminderAt: a.reminderAt ?? null,
  }
}

/** Plánované nahoře (nejbližší první), pak hotové/zrušené od nejnovějších */
function seradit(list: LeadActivity[]): LeadActivity[] {
  return [...list].sort((a, b) => {
    const pa = a.stav === 'PLANOVANA' ? 0 : 1
    const pb = b.stav === 'PLANOVANA' ? 0 : 1
    if (pa !== pb) return pa - pb
    const d = a.datum.localeCompare(b.datum) || (a.cas ?? '').localeCompare(b.cas ?? '')
    return pa === 0 ? d : -d
  })
}

export default function LeadAktivity({
  leadId,
  initial,
  users,
  currentUserId,
  canEdit,
}: {
  leadId: string
  initial: LeadActivity[]
  users: { id: string; jmeno: string }[]
  currentUserId: string
  canEdit: boolean
}) {
  const [aktivity, setAktivity] = useState(() => seradit(initial))
  const [adding, setAdding] = useState(false)
  const [typ, setTyp] = useState('HOVOR')
  const [datum, setDatum] = useState(dnes)
  const [cas, setCas] = useState('')
  const [popis, setPopis] = useState('')
  const [resitelId, setResitelId] = useState(currentUserId)
  const [reminderAt, setReminderAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [dokoncit, setDokoncit] = useState<LeadActivity | null>(null)

  function resetForm() {
    setTyp('HOVOR'); setDatum(dnes()); setCas(''); setPopis(''); setResitelId(currentUserId); setReminderAt('')
  }

  async function pridat() {
    if (!datum) return
    setSaving(true)
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          typ,
          datum,
          cas: cas || null,
          popis: popis.trim() || null,
          resitelId: resitelId || null,
          reminderAt: reminderAt ? new Date(reminderAt).toISOString() : null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { toast.error(data?.error ?? 'Aktivitu se nepodařilo přidat'); return }
      setAktivity(prev => seradit([fromApi(data), ...prev]))
      setAdding(false)
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  async function zrusit(a: LeadActivity) {
    setBusy(a.id)
    try {
      const res = await fetch(`/api/activities/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stav: 'ZRUSENA' }),
      })
      if (!res.ok) { toast.error('Nepodařilo se zrušit'); return }
      setAktivity(prev => seradit(prev.map(x => x.id === a.id ? { ...x, stav: 'ZRUSENA' } : x)))
    } finally {
      setBusy(null)
    }
  }

  async function smazat(a: LeadActivity) {
    if (!(await confirmDialog('Smazat tuto aktivitu?', { danger: true, confirmLabel: 'Smazat' }))) return
    setBusy(a.id)
    try {
      const res = await fetch(`/api/activities/${a.id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Nepodařilo se smazat'); return }
      setAktivity(prev => prev.filter(x => x.id !== a.id))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
      {dokoncit && (
        <DokoncitAktivituModal
          act={dokoncit}
          patchUrl={`/api/activities/${dokoncit.id}`}
          jeLead
          onClose={() => setDokoncit(null)}
          onDone={({ activity, followUp }) => {
            setAktivity(prev => seradit([
              ...(followUp ? [fromApi(followUp)] : []),
              ...prev.map(x => x.id === activity.id ? fromApi(activity) : x),
            ]))
          }}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
          Aktivity {aktivity.length > 0 && `(${aktivity.length})`}
        </h3>
        {canEdit && !adding && (
          <button onClick={() => setAdding(true)} className="text-sm text-[#3d8b40] dark:text-[#4CAF50] hover:underline">
            + Hovor / e-mail
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-4 p-4 rounded-lg bg-gray-50 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-700 space-y-3">
          <div className="flex gap-1.5">
            {TYPY.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTyp(t.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  typ === t.value
                    ? 'bg-[#4CAF50] text-white border-[#4CAF50]'
                    : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600'
                }`}
              >
                <ActivityTypeIcon typ={t.value} className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Datum</label>
              <input type="date" value={datum} onChange={e => setDatum(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Čas</label>
              <input type="time" value={cas} onChange={e => setCas(e.target.value)} className={inp} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Poznámka</label>
            <input type="text" value={popis} onChange={e => setPopis(e.target.value)} className={inp} placeholder="O čem to bude…" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Řešitel</label>
              <select value={resitelId} onChange={e => setResitelId(e.target.value)} className={inp}>
                {users.map(u => <option key={u.id} value={u.id}>{u.jmeno}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Připomínka</label>
              <input type="datetime-local" value={reminderAt} onChange={e => setReminderAt(e.target.value)} className={inp} />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={pridat}
              disabled={saving || !datum}
              className="px-4 py-2 bg-[#4CAF50] hover:bg-[#43A047] text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Ukládám…' : 'Přidat'}
            </button>
            <button onClick={() => { setAdding(false); resetForm() }} className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800">
              Zrušit
            </button>
          </div>
        </div>
      )}

      {aktivity.length === 0 && !adding && (
        <p className="text-gray-400 dark:text-slate-500 text-sm">Zatím žádné hovory ani e-maily</p>
      )}

      <div className="space-y-2">
        {aktivity.map(a => (
          <div key={a.id} className={`flex gap-3 p-2.5 -mx-2.5 rounded-lg ${a.stav !== 'PLANOVANA' ? 'opacity-60' : ''}`}>
            <ActivityTypeIcon typ={a.typ} className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-semibold text-gray-600 dark:text-slate-300 uppercase">{TYP_LABEL[a.typ] ?? a.typ}</span>
                <span className="text-gray-500 dark:text-slate-400">{formatDate(a.datum + 'T00:00:00')}{a.cas ? ` ${a.cas}` : ''}</span>
                {a.resitelJmeno && <span className="text-gray-400 dark:text-slate-500">· {a.resitelJmeno}</span>}
                {a.reminderAt && a.stav === 'PLANOVANA' && (
                  <span className="text-gray-400 dark:text-slate-500" title="Připomínka">
                    · ⏰ {formatDateTime(a.reminderAt)}
                  </span>
                )}
                <span className={`px-1.5 py-0.5 rounded-full font-medium ${STAV[a.stav].cls}`}>{STAV[a.stav].label}</span>
              </div>
              {a.popis && <p className="text-sm text-gray-800 dark:text-slate-200 mt-0.5 whitespace-pre-wrap">{a.popis}</p>}
              {a.vysledek && <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">✓ {a.vysledek}</p>}
              {canEdit && a.stav === 'PLANOVANA' && (
                <div className="flex gap-1.5 mt-1.5">
                  <button
                    onClick={() => setDokoncit(a)}
                    disabled={busy === a.id}
                    className="px-2 py-1 rounded-md text-xs font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 disabled:opacity-50"
                  >
                    ✓ Hotovo
                  </button>
                  <button
                    onClick={() => zrusit(a)}
                    disabled={busy === a.id}
                    className="px-2 py-1 rounded-md text-xs text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50"
                  >
                    Zrušit
                  </button>
                  <button
                    onClick={() => smazat(a)}
                    disabled={busy === a.id}
                    className="px-2 py-1 rounded-md text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                  >
                    Smazat
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
