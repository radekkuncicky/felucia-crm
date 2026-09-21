'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatDate } from '@/lib/format'
import { confirmDialog } from '@/components/ui/confirm'

export interface Ukol {
  id: string
  text: string
  poznamka: string | null
  termin: string | null
  hotovo: boolean
  hotovoAt: string | null
  resitelId: string | null
  resitel: { id: string; jmeno: string } | null
}

interface Props {
  zakazkaId: string
  ukoly: Ukol[]
  uzivatele: { id: string; jmeno: string }[]
  currentUserId: string
}

type FormState = { text: string; poznamka: string; termin: string; resitelId: string }
const EMPTY: FormState = { text: '', poznamka: '', termin: '', resitelId: '' }

const INPUT = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary'

function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

/** Termín: po termínu (a nehotovo) → červeně, dnes → oranžově. */
function terminClass(u: Ukol): string {
  if (!u.termin || u.hotovo) return 'text-gray-500 dark:text-slate-400'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const t = new Date(u.termin); t.setHours(0, 0, 0, 0)
  if (t < today) return 'text-red-600 dark:text-red-400 font-medium'
  if (t.getTime() === today.getTime()) return 'text-amber-600 dark:text-amber-400 font-medium'
  return 'text-gray-500 dark:text-slate-400'
}

export default function UkolyTab({ zakazkaId, ukoly: initial, uzivatele, currentUserId }: Props) {
  const router = useRouter()
  const [ukoly, setUkoly] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const otevrene = ukoly.filter(u => !u.hotovo)
  const hotove = ukoly.filter(u => u.hotovo)

  function openAdd() {
    setEditId(null)
    setForm({ ...EMPTY, resitelId: currentUserId })
    setShowForm(true)
  }

  function openEdit(u: Ukol) {
    setEditId(u.id)
    setForm({ text: u.text, poznamka: u.poznamka ?? '', termin: toDateInput(u.termin), resitelId: u.resitelId ?? '' })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY)
  }

  async function handleSave() {
    if (!form.text.trim()) { toast.error('Napište, co je potřeba udělat'); return }
    setSaving(true)
    try {
      const url = editId ? `/api/zakazky/${zakazkaId}/ukoly/${editId}` : `/api/zakazky/${zakazkaId}/ukoly`
      const res = await fetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, termin: form.termin || null, resitelId: form.resitelId || null }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Uložení selhalo')
        return
      }
      const saved: Ukol = await res.json()
      setUkoly(prev => (editId ? prev.map(u => (u.id === editId ? saved : u)) : [...prev, saved]))
      toast.success(editId ? 'Úkol upraven' : 'Úkol přidán')
      closeForm()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function toggleHotovo(u: Ukol) {
    setBusyId(u.id)
    // optimisticky
    setUkoly(prev => prev.map(x => (x.id === u.id ? { ...x, hotovo: !u.hotovo } : x)))
    try {
      const res = await fetch(`/api/zakazky/${zakazkaId}/ukoly/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotovo: !u.hotovo }),
      })
      if (!res.ok) {
        setUkoly(prev => prev.map(x => (x.id === u.id ? u : x)))
        toast.error('Změna se neuložila')
        return
      }
      const saved: Ukol = await res.json()
      setUkoly(prev => prev.map(x => (x.id === u.id ? saved : x)))
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!await confirmDialog('Opravdu smazat úkol?', { title: 'Smazat úkol', confirmLabel: 'Smazat' })) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/zakazky/${zakazkaId}/ukoly/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setUkoly(prev => prev.filter(u => u.id !== id))
        router.refresh()
      } else {
        toast.error('Smazání selhalo')
      }
    } finally {
      setBusyId(null)
    }
  }

  function Row({ u }: { u: Ukol }) {
    return (
      <div className="px-5 py-3 flex items-start gap-3">
        <input
          type="checkbox"
          checked={u.hotovo}
          disabled={busyId === u.id}
          onChange={() => toggleHotovo(u)}
          className="mt-1 w-5 h-5 rounded border-gray-300 dark:border-slate-600 text-primary focus:ring-primary cursor-pointer disabled:opacity-50"
          aria-label={u.hotovo ? 'Vrátit mezi otevřené' : 'Označit hotovo'}
        />
        <div className="min-w-0 flex-1">
          <div className={`text-sm ${u.hotovo ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-900 dark:text-white'}`}>
            {u.text}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
            {u.termin && <span className={terminClass(u)}>{formatDate(u.termin)}</span>}
            {u.resitel && <span className="text-gray-500 dark:text-slate-400">{u.resitel.jmeno}</span>}
            {u.hotovo && u.hotovoAt && <span className="text-gray-400 dark:text-slate-500">hotovo {formatDate(u.hotovoAt)}</span>}
          </div>
          {u.poznamka && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400 whitespace-pre-line">{u.poznamka}</p>}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={() => openEdit(u)} className="text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200">
            Upravit
          </button>
          <button
            onClick={() => handleDelete(u.id)}
            disabled={busyId === u.id}
            className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
          >
            Smazat
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Úkoly
          <span className="ml-2 text-sm font-normal text-gray-500 dark:text-slate-400">
            {otevrene.length} otevřených · {hotove.length} hotových
          </span>
        </h3>
        {!showForm && (
          <button onClick={openAdd} className="text-sm font-medium text-primary dark:text-primary-light hover:underline">
            + Přidat úkol
          </button>
        )}
      </div>

      {showForm && (
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Co je potřeba udělat *</label>
            <input
              autoFocus
              value={form.text}
              onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              placeholder="např. Objednat venkovní jednotku"
              className={INPUT}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Termín</label>
              <input type="date" value={form.termin} onChange={e => setForm(f => ({ ...f, termin: e.target.value }))} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Řešitel</label>
              <select value={form.resitelId} onChange={e => setForm(f => ({ ...f, resitelId: e.target.value }))} className={INPUT}>
                <option value="">— nepřiřazeno —</option>
                {uzivatele.map(u => <option key={u.id} value={u.id}>{u.jmeno}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Poznámka</label>
              <input value={form.poznamka} onChange={e => setForm(f => ({ ...f, poznamka: e.target.value }))} className={INPUT} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50"
            >
              {saving ? 'Ukládám…' : editId ? 'Uložit změny' : 'Přidat'}
            </button>
            <button onClick={closeForm} className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400">Zrušit</button>
          </div>
        </div>
      )}

      {ukoly.length === 0 ? (
        <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">
          Zatím žádné úkoly. Sem patří interní kroky realizace — objednávky, domluvy s řemesly, faktury.
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {otevrene.map(u => <Row key={u.id} u={u} />)}
          </div>
          {hotove.length > 0 && (
            <details className="border-t border-gray-100 dark:border-slate-700">
              <summary className="px-5 py-2.5 text-xs font-medium text-gray-500 dark:text-slate-400 cursor-pointer select-none">
                Hotové ({hotove.length})
              </summary>
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {hotove.map(u => <Row key={u.id} u={u} />)}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}
