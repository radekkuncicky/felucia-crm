'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'

interface FieldData {
  id: string
  entityType: string
  nazev: string
  typ: string
  povinne: boolean
  povinneOdStavu: string
  poradi: number
  aktivni: boolean
}

interface EntityType {
  key: string
  label: string
  icon: React.ReactNode
}

const TYP_OPTIONS = [
  { value: 'TEXT', label: 'Text' },
  { value: 'CISLO', label: 'Číslo' },
  { value: 'DATUM', label: 'Datum' },
  { value: 'CHECKBOX', label: 'Ano/Ne' },
  { value: 'VYBER', label: 'Výběr ze seznamu' },
]

const STAV_OPTIONS = [
  { value: '', label: 'Vždy povinné' },
  { value: 'JEDNANI', label: 'Od: Jednání' },
  { value: 'NABIDKA', label: 'Od: Nabídka' },
  { value: 'PRED_UZAVRENIM', label: 'Od: Před uzavřením' },
]

export default function EvidenceManager({ entityTypes, fields: initFields }: { entityTypes: EntityType[], fields: FieldData[] }) {
  const router = useRouter()
  const [fields, setFields] = useState(initFields)
  const [activeEntity, setActiveEntity] = useState(entityTypes[0].key)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null)
  const [form, setForm] = useState({ nazev: '', typ: 'TEXT', povinne: false, povinneOdStavu: '' })

  const entityFields = fields.filter(f => f.entityType === activeEntity)

  async function handleCreate() {
    if (!form.nazev.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, entityType: activeEntity }),
      })
      if (res.ok) {
        const f = await res.json()
        setFields(prev => [...prev, f])
        setShowForm(false)
        setForm({ nazev: '', typ: 'TEXT', povinne: false, povinneOdStavu: '' })
        router.refresh()
      }
    } finally { setSaving(false) }
  }

  async function toggleActive(field: FieldData) {
    await fetch(`/api/settings/evidence/${field.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktivni: !field.aktivni }),
    })
    setFields(prev => prev.map(f => f.id === field.id ? { ...f, aktivni: !f.aktivni } : f))
  }

  async function deleteFieldConfirm() {
    if (!deleteFieldId) return
    await fetch(`/api/settings/evidence/${deleteFieldId}`, { method: 'DELETE' })
    setFields(prev => prev.filter(f => f.id !== deleteFieldId))
    setDeleteFieldId(null)
  }

  const inp = 'border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <div className="space-y-4">
      <ConfirmModal
        isOpen={deleteFieldId !== null}
        title="Smazat pole"
        message="Smazat toto pole? Tato akce je nevratná."
        confirmLabel="Smazat"
        danger
        onConfirm={deleteFieldConfirm}
        onCancel={() => setDeleteFieldId(null)}
      />
      {/* Entity type tabs */}
      <div className="flex gap-2 flex-wrap">
        {entityTypes.map(et => (
          <button
            key={et.key}
            onClick={() => { setActiveEntity(et.key); setShowForm(false) }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${activeEntity === et.key ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-primary-light'}`}
          >
            <span>{et.icon}</span>
            <span>{et.label}</span>
            <span className="text-xs opacity-70">({fields.filter(f => f.entityType === et.key).length})</span>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Vlastní pole: {entityTypes.find(e => e.key === activeEntity)?.label}
          </h3>
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-sm text-primary dark:text-primary-light hover:text-blue-800 border border-blue-300 dark:border-blue-700 px-3 py-1.5 rounded-lg">
              + Přidat pole
            </button>
          )}
        </div>

        {showForm && (
          <div className="px-5 py-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Název pole *</label>
                <input value={form.nazev} onChange={e => setForm(f => ({ ...f, nazev: e.target.value }))} className={inp} placeholder="Např. Referenční číslo" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Typ</label>
                <select value={form.typ} onChange={e => setForm(f => ({ ...f, typ: e.target.value }))} className={inp + ' w-full'}>
                  {TYP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={form.povinne} onChange={e => setForm(f => ({ ...f, povinne: e.target.checked }))} className="rounded border-gray-300" />
                Povinné pole
              </label>
              {form.povinne && activeEntity === 'Deal' && (
                <select value={form.povinneOdStavu} onChange={e => setForm(f => ({ ...f, povinneOdStavu: e.target.value }))} className={inp}>
                  {STAV_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={saving || !form.nazev.trim()} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50">
                {saving ? 'Ukládám…' : 'Přidat pole'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800">Zrušit</button>
            </div>
          </div>
        )}

        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-slate-900">
            <tr>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-5 py-3">Název</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-4 py-3">Typ</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-4 py-3">Povinné</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-4 py-3">Stav</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {entityFields.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400 dark:text-slate-500">Žádná vlastní pole. Přidejte první pole.</td></tr>
            )}
            {entityFields.map(f => (
              <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{f.nazev}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-400">{TYP_OPTIONS.find(t => t.value === f.typ)?.label ?? f.typ}</td>
                <td className="px-4 py-3">
                  {f.povinne ? (
                    <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full">
                      {f.povinneOdStavu ? `Od: ${f.povinneOdStavu}` : 'Vždy'}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-slate-500">Volitelné</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(f)} className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.aktivni ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
                    {f.aktivni ? 'Aktivní' : 'Neaktivní'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setDeleteFieldId(f.id)} className="text-xs text-red-400 hover:text-red-600">Smazat</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
