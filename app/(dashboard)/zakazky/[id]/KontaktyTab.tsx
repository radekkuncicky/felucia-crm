'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PROFESE_PRESETY } from '@/lib/zakazkaKontakt'

interface Kontakt {
  id: string
  profese: string
  jmeno: string | null
  telefon: string | null
  email: string | null
  poznamka: string | null
}

interface Props {
  zakazkaId: string
  kontakty: Kontakt[]
  canEdit: boolean
}

type FormState = {
  profese: string
  jmeno: string
  telefon: string
  email: string
  poznamka: string
}

const EMPTY: FormState = { profese: '', jmeno: '', telefon: '', email: '', poznamka: '' }

export default function KontaktyTab({ zakazkaId, kontakty: initial, canEdit }: Props) {
  const router = useRouter()
  const [kontakty, setKontakty] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  function openAdd() {
    setEditId(null)
    setForm(EMPTY)
    setShowForm(true)
  }

  function openEdit(k: Kontakt) {
    setEditId(k.id)
    setForm({
      profese: k.profese,
      jmeno: k.jmeno ?? '',
      telefon: k.telefon ?? '',
      email: k.email ?? '',
      poznamka: k.poznamka ?? '',
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY)
  }

  async function handleSave() {
    if (!form.profese.trim()) { toast.error('Vyplňte profesi'); return }
    if (!form.telefon.trim()) { toast.error('Vyplňte telefon'); return }
    setSaving(true)
    try {
      const url = editId
        ? `/api/zakazky/${zakazkaId}/kontakty/${editId}`
        : `/api/zakazky/${zakazkaId}/kontakty`
      const res = await fetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Uložení selhalo')
        return
      }
      const saved: Kontakt = await res.json()
      setKontakty(prev =>
        editId ? prev.map(k => (k.id === editId ? saved : k)) : [...prev, saved],
      )
      toast.success(editId ? 'Kontakt upraven' : 'Kontakt přidán')
      closeForm()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Opravdu smazat kontakt?')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/zakazky/${zakazkaId}/kontakty/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setKontakty(prev => prev.filter(k => k.id !== id))
        router.refresh()
      } else {
        toast.error('Smazání selhalo')
      }
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">Kontakty na stavbě ({kontakty.length})</h3>
        {canEdit && !showForm && (
          <button onClick={openAdd} className="text-sm font-medium text-primary dark:text-primary-light hover:underline">
            + Přidat kontakt
          </button>
        )}
      </div>

      {showForm && (
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Profese *</label>
            <input
              value={form.profese}
              onChange={e => setForm(f => ({ ...f, profese: e.target.value }))}
              placeholder="např. Elektrikář"
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PROFESE_PRESETY.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, profese: p }))}
                  className="px-2.5 py-1 text-xs rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-primary/10 hover:text-primary dark:hover:text-primary-light transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Jméno</label>
              <input
                value={form.jmeno}
                onChange={e => setForm(f => ({ ...f, jmeno: e.target.value }))}
                placeholder="Jan Novák"
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Telefon *</label>
              <input
                value={form.telefon}
                onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))}
                placeholder="+420 …"
                inputMode="tel"
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Email</label>
              <input
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jan@…"
                inputMode="email"
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Poznámka</label>
              <input
                value={form.poznamka}
                onChange={e => setForm(f => ({ ...f, poznamka: e.target.value }))}
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
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

      {kontakty.length === 0 ? (
        <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">Zatím žádné kontakty</div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-slate-700">
          {kontakty.map(k => (
            <div key={k.id} className="px-5 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary dark:text-primary-light">
                    {k.profese}
                  </span>
                  {k.jmeno && <span className="font-medium text-gray-900 dark:text-white text-sm">{k.jmeno}</span>}
                </div>
                <div className="mt-1 space-y-0.5">
                  {k.telefon && (
                    <a href={`tel:${k.telefon}`} className="block text-sm text-primary dark:text-primary-light hover:underline">
                      {k.telefon}
                    </a>
                  )}
                  {k.email && (
                    <a href={`mailto:${k.email}`} className="block text-xs text-gray-500 dark:text-slate-400 hover:underline">
                      {k.email}
                    </a>
                  )}
                  {k.poznamka && <p className="text-xs text-gray-500 dark:text-slate-400">{k.poznamka}</p>}
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button onClick={() => openEdit(k)} className="text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200">
                    Upravit
                  </button>
                  <button
                    onClick={() => handleDelete(k.id)}
                    disabled={deleting === k.id}
                    className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                  >
                    {deleting === k.id ? 'Mažu…' : 'Smazat'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
