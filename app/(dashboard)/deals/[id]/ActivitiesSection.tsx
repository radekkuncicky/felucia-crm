'use client'

import { useState, useCallback } from 'react'
import ConfirmModal from '@/components/ConfirmModal'

const typOptions = [
  { value: 'HOVOR',    label: 'Hovor',     icon: '📞' },
  { value: 'EMAIL',    label: 'Email',     icon: '✉️' },
  { value: 'SCHUZKA',  label: 'Schůzka',   icon: '🤝' },
  { value: 'POZNAMKA', label: 'Poznámka',  icon: '📝' },
  { value: 'UKOL',     label: 'Úkol',      icon: '✅' },
]

const stavConfig = {
  PLANOVANA: { label: 'Plánovaná', dot: 'bg-gray-400',   btn: 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 ring-gray-400' },
  DOKONCENA: { label: 'Dokončena', dot: 'bg-green-500',  btn: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 ring-green-500' },
  ZRUSENA:   { label: 'Zrušena',   dot: 'bg-red-500',    btn: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 ring-red-500' },
} as const

type Stav = keyof typeof stavConfig

// datetime-local input pracuje v lokálním čase, server ukládá UTC ISO
function isoToLocalInput(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}
function localInputToIso(val: string) {
  return val ? new Date(val).toISOString() : null
}

interface Activity {
  id: string
  typ: string
  popis: string | null
  datum: string
  cas: string | null
  trvaniMin: number | null
  splneno: boolean
  stav: Stav
  userJmeno: string
  cil: string | null
  vysledek: string | null
  misto: string | null
  resitelJmeno: string | null
  resitelId: string | null
  reminderAt?: string | null
}

interface Props {
  dealId: string
  activities: Activity[]
  users: { id: string; jmeno: string }[]
  currentUserId: string
  currentUserJmeno: string
}

const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary'

const TRVANI_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hod' },
  { value: 90, label: '1,5 h' },
  { value: 120, label: '2 hod' },
]

function TrvaniPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {TRVANI_OPTIONS.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-2 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            value === o.value
              ? 'bg-primary text-white border-primary'
              : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-primary-light'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function fmtTrvani(min: number | null): string {
  if (!min) return ''
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h} h ${m} min` : `${h} hod`
}

function StavDot({ stav }: { stav: Stav }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${stavConfig[stav]?.dot ?? 'bg-gray-400'}`} />
}

// ─── Edit / View Modal ─────────────────────────────────────────────────────────

function ActivityModal({
  act, dealId, users, onClose, onSaved, onDeleted, onFollowUp,
}: {
  act: Activity
  dealId: string
  users: { id: string; jmeno: string }[]
  onClose: () => void
  onSaved: (updated: Activity) => void
  onDeleted: (id: string) => void
  onFollowUp: (act: Activity) => void
}) {
  const [stav, setStav]           = useState<Stav>(act.stav)
  const [typ, setTyp]             = useState(act.typ)
  const [datum, setDatum]         = useState(act.datum)
  const [cas, setCas]             = useState(act.cas ?? '')
  const [trvaniMin, setTrvaniMin] = useState<number>(act.trvaniMin ?? 15)
  const [popis, setPopis]         = useState(act.popis ?? '')
  const [cil, setCil]             = useState(act.cil ?? '')
  const [vysledek, setVysledek]   = useState(act.vysledek ?? '')
  const [misto, setMisto]         = useState(act.misto ?? '')
  const [resitelId, setResitelId] = useState(act.resitelId ?? '')
  const [reminderAt, setReminderAt] = useState(isoToLocalInput(act.reminderAt))
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [error, setError]         = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const t = typOptions.find(o => o.value === typ)

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/deals/${dealId}/activities/${act.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stav,
          typ,
          datum,
          cas: cas || null,
          trvaniMin,
          popis: popis || null,
          cil: cil || null,
          vysledek: vysledek || null,
          misto: misto || null,
          resitelId: resitelId || null,
          reminderAt: localInputToIso(reminderAt),
        }),
      })
      if (res.ok) {
        await res.json()
        onSaved({
          ...act,
          stav,
          typ,
          datum,
          cas: cas || null,
          trvaniMin,
          popis: popis || null,
          cil: cil || null,
          vysledek: vysledek || null,
          misto: misto || null,
          resitelId: resitelId || null,
          resitelJmeno: users.find(u => u.id === resitelId)?.jmeno ?? null,
          splneno: stav === 'DOKONCENA',
          reminderAt: localInputToIso(reminderAt),
        })
        onClose()
      } else {
        setError('Nepodařilo se uložit aktivitu')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteConfirm() {
    setConfirmDelete(false)
    setDeleting(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/activities/${act.id}`, { method: 'DELETE' })
      if (res.ok) { onDeleted(act.id); onClose() }
      else setError('Aktivitu se nepodařilo smazat')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <ConfirmModal isOpen={confirmDelete} title="Smazat aktivitu" message="Smazat tuto aktivitu?" confirmLabel="Smazat" danger loading={deleting} onConfirm={handleDeleteConfirm} onCancel={() => setConfirmDelete(false)} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{t?.icon ?? '•'}</span>
              <p className="font-semibold text-gray-900 dark:text-white">Upravit aktivitu</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="px-6 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Zadavatel (readonly) */}
            {act.userJmeno && (
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Zadal: <strong className="text-gray-700 dark:text-slate-300">{act.userJmeno}</strong></span>
              </div>
            )}

            {/* Typ + Datum */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Typ</label>
                <select value={typ} onChange={e => setTyp(e.target.value)} className={inp}>
                  {typOptions.map(o => <option key={o.value} value={o.value}>{o.icon} {o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Datum</label>
                <input type="date" value={datum} onChange={e => setDatum(e.target.value)} className={inp} />
              </div>
            </div>

            {/* Čas + Trvání */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Čas</label>
                <input type="time" value={cas} onChange={e => setCas(e.target.value)} className={inp} placeholder="–:–" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Trvání</label>
                <TrvaniPicker value={trvaniMin} onChange={setTrvaniMin} />
              </div>
            </div>

            {/* Místo schůzky */}
            {typ === 'SCHUZKA' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                  📍 Místo schůzky
                </label>
                <input
                  type="text"
                  value={misto}
                  onChange={e => setMisto(e.target.value)}
                  className={inp}
                  placeholder="Adresa, název místa…"
                />
              </div>
            )}

            {/* Stav */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">Stav</label>
              <div className="flex gap-2">
                {(['PLANOVANA', 'DOKONCENA', 'ZRUSENA'] as Stav[]).map(s => (
                  <button key={s} onClick={() => setStav(s)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${stav === s ? `ring-2 ${stavConfig[s].btn}` : 'bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                    <StavDot stav={s} />
                    {stavConfig[s].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Popis */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Popis / průběh</label>
              <textarea rows={2} value={popis} onChange={e => setPopis(e.target.value)} className={inp} placeholder="Volitelně — co se dělo, o čem se mluvilo…" />
            </div>

            {/* Cíl */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Cíl aktivity</label>
              <textarea rows={2} value={cil} onChange={e => setCil(e.target.value)} className={inp} placeholder="Co chci touto aktivitou dosáhnout…" />
            </div>

            {/* Výsledek */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Výsledek</label>
              {stav === 'PLANOVANA' ? (
                <textarea rows={2} className="w-full border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500 cursor-not-allowed" disabled placeholder="Dostupné po změně stavu…" />
              ) : (
                <textarea rows={2} value={vysledek} onChange={e => setVysledek(e.target.value)} className={inp} placeholder="Co bylo výsledkem, na čem se dohodli…" />
              )}
            </div>

            {/* Řešitel */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Řešitel</label>
              <select value={resitelId} onChange={e => setResitelId(e.target.value)} className={inp}>
                <option value="">— nevybráno —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.jmeno}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Připomínka</label>
              <input type="datetime-local" value={reminderAt} onChange={e => setReminderAt(e.target.value)} className={inp} />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">V daný čas přijde upozornění do CRM a emailem.</p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700">
            {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}
            <div className="flex items-center justify-between gap-3">
              <button onClick={() => setConfirmDelete(true)} disabled={deleting} className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-50">
                {deleting ? 'Mažu…' : 'Smazat'}
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => { onFollowUp(act); onClose() }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg">
                  + Navazující
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50">
                  {saving ? 'Ukládám…' : 'Uložit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Add Modal ────────────────────────────────────────────────────────────────

function AddActivityModal({
  form, setForm, users, saving, error, onAdd, onClose, currentUserJmeno,
}: {
  form: { typ: string; popis: string; datum: string; cas: string; trvaniMin: number; resitelId: string; cil: string; vysledek: string; misto: string; reminderAt: string }
  setForm: React.Dispatch<React.SetStateAction<typeof form>>
  users: { id: string; jmeno: string }[]
  saving: boolean
  error: string
  onAdd: () => void
  onClose: () => void
  currentUserJmeno: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Nová aktivita</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Zadavatel */}
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>Zadavatel: <strong className="text-gray-700 dark:text-slate-300">{currentUserJmeno}</strong></span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Typ</label>
              <select value={form.typ} onChange={e => setForm(f => ({ ...f, typ: e.target.value }))} className={inp}>
                {typOptions.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Datum</label>
              <input type="date" value={form.datum} onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Čas</label>
              <input type="time" value={form.cas} onChange={e => setForm(f => ({ ...f, cas: e.target.value }))} className={inp} placeholder="–:–" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Trvání</label>
              <TrvaniPicker value={form.trvaniMin} onChange={v => setForm(f => ({ ...f, trvaniMin: v }))} />
            </div>
          </div>
          {form.typ === 'SCHUZKA' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">📍 Místo schůzky</label>
              <input type="text" value={form.misto} onChange={e => setForm(f => ({ ...f, misto: e.target.value }))} className={inp} placeholder="Adresa, název místa…" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Popis / průběh</label>
            <textarea rows={2} value={form.popis} onChange={e => setForm(f => ({ ...f, popis: e.target.value }))} className={inp} placeholder="Volitelně — o čem to bude, co se plánuje…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Cíl aktivity</label>
            <textarea rows={2} value={form.cil} onChange={e => setForm(f => ({ ...f, cil: e.target.value }))} className={inp} placeholder="Co chci dosáhnout…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Výsledek</label>
            <textarea rows={2} value={form.vysledek} onChange={e => setForm(f => ({ ...f, vysledek: e.target.value }))} className={inp} placeholder="Vyplňte po dokončení…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Řešitel</label>
            <select value={form.resitelId} onChange={e => setForm(f => ({ ...f, resitelId: e.target.value }))} className={inp}>
              <option value="">— nevybráno —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.jmeno}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Připomínka</label>
            <input type="datetime-local" value={form.reminderAt} onChange={e => setForm(f => ({ ...f, reminderAt: e.target.value }))} className={inp} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700">
          {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800">Zrušit</button>
            <button onClick={onAdd} disabled={saving || !form.datum} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50">
              {saving ? 'Ukládám…' : 'Přidat'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Quick action button ───────────────────────────────────────────────────────

function QuickAction({ label, onClick, loading, variant = 'default' }: {
  label: string
  onClick: () => void
  loading?: boolean
  variant?: 'default' | 'green' | 'red'
}) {
  const base = 'px-2 py-0.5 rounded text-xs font-medium border transition-all disabled:opacity-50'
  const color = variant === 'green'
    ? 'border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30'
    : variant === 'red'
    ? 'border-red-300 dark:border-red-700 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
    : 'border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
  return (
    <button className={`${base} ${color}`} onClick={e => { e.stopPropagation(); onClick() }} disabled={loading}>
      {loading ? '…' : label}
    </button>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

const emptyForm = (currentUserId = '') => ({
  typ: 'HOVOR',
  popis: '',
  datum: new Date().toISOString().split('T')[0],
  cas: '',
  trvaniMin: 15,
  resitelId: currentUserId,
  cil: '',
  vysledek: '',
  misto: '',
  reminderAt: '',
})

export default function ActivitiesSection({ dealId, activities: initActivities, users, currentUserId, currentUserJmeno }: Props) {
  const [activities, setActivities] = useState(initActivities)
  const [adding, setAdding]         = useState(false)
  const [addingModal, setAddingModal] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [addError, setAddError]     = useState('')
  const [selectedAct, setSelectedAct] = useState<Activity | null>(null)
  const [quickLoading, setQuickLoading] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState(() => emptyForm(currentUserId))

  const typMap = Object.fromEntries(typOptions.map(t => [t.value, t]))

  function openFollowUp(act: Activity) {
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + 7)
    setForm({ ...emptyForm(currentUserId), typ: act.typ, datum: nextDate.toISOString().split('T')[0], resitelId: act.resitelId ?? currentUserId })
    setAddingModal(true)
  }

  async function handleAdd() {
    if (!form.datum) return
    setSaving(true)
    setAddError('')
    try {
      const res = await fetch(`/api/deals/${dealId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typ: form.typ,
          popis: form.popis || null,
          datum: form.datum,
          cas: form.cas || null,
          trvaniMin: form.trvaniMin,
          cil: form.cil || null,
          vysledek: form.vysledek || null,
          misto: form.misto || null,
          resitelId: form.resitelId || null,
          reminderAt: localInputToIso(form.reminderAt),
        }),
      })
      if (res.ok) {
        const act = await res.json()
        setActivities(prev => [{
          id: act.id,
          typ: act.typ,
          popis: act.popis ?? null,
          datum: new Date(act.datum).toISOString().split('T')[0],
          cas: act.cas ?? null,
          trvaniMin: act.trvaniMin ?? 15,
          splneno: act.splneno,
          stav: act.stav ?? 'PLANOVANA',
          userJmeno: act.user?.jmeno ?? '',
          cil: act.cil ?? null,
          vysledek: act.vysledek ?? null,
          misto: act.misto ?? null,
          resitelJmeno: act.resitel?.jmeno ?? null,
          resitelId: act.resitelId ?? null,
          reminderAt: act.reminderAt ?? null,
        }, ...prev])
        setAdding(false)
        setAddingModal(false)
        setForm(emptyForm(currentUserId))
      } else {
        setAddError('Nepodařilo se přidat aktivitu')
      }
    } finally {
      setSaving(false)
    }
  }

  // Quick patch helper
  const quickPatch = useCallback(async (actId: string, body: Record<string, unknown>) => {
    setQuickLoading(p => ({ ...p, [actId]: true }))
    try {
      const res = await fetch(`/api/deals/${dealId}/activities/${actId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const updated = await res.json()
        setActivities(prev => prev.map(a => a.id !== actId ? a : {
          ...a,
          stav: updated.stav,
          splneno: updated.splneno,
          datum: new Date(updated.datum).toISOString().split('T')[0],
        }))
      }
    } finally {
      setQuickLoading(p => ({ ...p, [actId]: false }))
    }
  }, [dealId])

  function shiftDate(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T00:00:00')
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      {selectedAct && (
        <ActivityModal
          act={selectedAct}
          dealId={dealId}
          users={users}
          onClose={() => setSelectedAct(null)}
          onSaved={updated => {
            setActivities(prev => prev.map(a => a.id === updated.id ? updated : a))
            setSelectedAct(null)
          }}
          onDeleted={id => setActivities(prev => prev.filter(a => a.id !== id))}
          onFollowUp={openFollowUp}
        />
      )}
      {addingModal && (
        <AddActivityModal
          form={form} setForm={setForm}
          users={users} saving={saving} error={addError}
          onAdd={handleAdd} onClose={() => setAddingModal(false)}
          currentUserJmeno={currentUserJmeno}
        />
      )}

      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-white">Aktivity ({activities.length})</h2>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-sm text-primary dark:text-primary-light hover:text-blue-800 border border-blue-300 dark:border-blue-700 px-3 py-1.5 rounded-lg">
            + Přidat aktivitu
          </button>
        )}
      </div>

      {/* Inline quick-add */}
      {adding && (
        <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 space-y-3">
          <div className="flex items-center gap-1.5 text-xs text-primary dark:text-primary-light">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Zadavatel: <strong>{currentUserJmeno}</strong>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Typ</label>
              <select value={form.typ} onChange={e => setForm(f => ({ ...f, typ: e.target.value }))} className={inp}>
                {typOptions.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Datum</label>
              <input type="date" value={form.datum} onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Čas</label>
              <input type="time" value={form.cas} onChange={e => setForm(f => ({ ...f, cas: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Trvání</label>
              <TrvaniPicker value={form.trvaniMin} onChange={v => setForm(f => ({ ...f, trvaniMin: v }))} />
            </div>
          </div>
          {form.typ === 'SCHUZKA' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">📍 Místo schůzky</label>
              <input type="text" value={form.misto} onChange={e => setForm(f => ({ ...f, misto: e.target.value }))} className={inp} placeholder="Adresa, název místa…" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Popis / průběh</label>
            <textarea rows={2} value={form.popis} onChange={e => setForm(f => ({ ...f, popis: e.target.value }))} className={inp} placeholder="Volitelně…" />
          </div>
          {addError && <p className="text-sm text-red-600 dark:text-red-400">{addError}</p>}
          <div className="flex gap-2 items-center">
            <button onClick={handleAdd} disabled={saving || !form.datum}
              className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50">
              {saving ? 'Ukládám…' : 'Přidat'}
            </button>
            <button onClick={() => { setAdding(false); setAddingModal(true) }}
              className="px-3 py-2 text-sm text-primary dark:text-primary-light hover:underline">
              Více polí →
            </button>
            <button onClick={() => setAdding(false)} className="ml-auto px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800">
              Zrušit
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="divide-y divide-gray-100 dark:divide-slate-700">
        {activities.length === 0 && !adding && (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-gray-400 dark:text-slate-500 mb-3">Zatím žádné aktivity</p>
            <button onClick={() => setAdding(true)} className="text-sm text-primary dark:text-primary-light hover:underline">
              + Přidat první aktivitu
            </button>
          </div>
        )}
        {activities.map(act => {
          const t = typMap[act.typ]
          const stav = act.stav ?? 'PLANOVANA'
          const loading = quickLoading[act.id] ?? false
          return (
            <div key={act.id} className={`group px-6 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors ${stav === 'DOKONCENA' ? 'opacity-60' : ''}`}>
              <div className="flex gap-3">
                {/* Icon */}
                <div className="text-xl flex-shrink-0 mt-0.5 cursor-pointer" onClick={() => setSelectedAct(act)}>
                  {t?.icon ?? '•'}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedAct(act)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StavDot stav={stav} />
                    <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">{t?.label ?? act.typ}</span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">
                      {new Date(act.datum + 'T00:00:00').toLocaleDateString('cs-CZ')}
                    </span>
                    {act.cas && (
                      <span className="text-xs font-medium text-primary dark:text-primary-light">
                        🕐 {act.cas}{act.trvaniMin ? ` · ${fmtTrvani(act.trvaniMin)}` : ''}
                      </span>
                    )}
                    {act.userJmeno && <span className="text-xs text-gray-400 dark:text-slate-500">· {act.userJmeno}</span>}
                    {act.resitelJmeno && <span className="text-xs text-gray-400 dark:text-slate-500">· Řešitel: {act.resitelJmeno}</span>}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${stavConfig[stav]?.btn ?? ''}`}>
                      {stavConfig[stav]?.label ?? stav}
                    </span>
                  </div>
                  {act.misto && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">📍 {act.misto}</p>}
                  {act.cil && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Cíl: {act.cil}</p>}
                  {act.popis && <p className="text-sm text-gray-800 dark:text-slate-200 mt-0.5">{act.popis}</p>}
                  {act.vysledek && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">✓ Výsledek: {act.vysledek}</p>
                  )}
                </div>
              </div>

              {/* Quick actions — visible on hover, only for PLANOVANA */}
              {stav === 'PLANOVANA' && (
                <div className="flex gap-1.5 mt-2 ml-8 opacity-0 group-hover:opacity-100 transition-opacity">
                  <QuickAction label="✓ Hotovo" onClick={() => quickPatch(act.id, { stav: 'DOKONCENA' })} loading={loading} variant="green" />
                  <QuickAction label="+1 den" onClick={() => quickPatch(act.id, { datum: shiftDate(act.datum, 1) })} loading={loading} />
                  <QuickAction label="+1 týden" onClick={() => quickPatch(act.id, { datum: shiftDate(act.datum, 7) })} loading={loading} />
                  <QuickAction label="Zrušit" onClick={() => quickPatch(act.id, { stav: 'ZRUSENA' })} loading={loading} variant="red" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
