'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import ClientSelectWithCreate, { type Client } from '@/components/ClientSelectWithCreate'
import { ZARIZENI_TYP_LABEL } from '@/lib/calendarEvents'

interface Props {
  clients: Client[]
  /** Předvybraný klient (z karty klienta v portfoliu) — výběr se pak nezobrazuje. */
  klientId?: string
  onClose: () => void
  onCreated: () => void
}

const inp = 'w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary'
const lbl = 'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'

// Založení zařízení (přeneseno ze /servis/zarizeni). Klient se vybírá přes
// ClientSelectWithCreate — jde tedy založit i klienta, který ještě v CRM není.
export default function NoveZarizeniModal({ clients, klientId: fixedKlientId, onClose, onCreated }: Props) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    klientId: fixedKlientId ?? '',
    nazev: '',
    typ: 'JINE',
    vyrobniCislo: '',
    datumInstalace: '',
    zarukaDo: '',
    poznamka: '',
  })
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.klientId || !form.nazev.trim()) return
    setSaving(true)
    try {
      const res = await api.post('/api/servis/zarizeni', {
        klientId: form.klientId,
        nazev: form.nazev.trim(),
        typ: form.typ,
        vyrobniCislo: form.vyrobniCislo || null,
        datumInstalace: form.datumInstalace || null,
        zarukaDo: form.zarukaDo || null,
        poznamka: form.poznamka || null,
      }, { errorMessage: 'Zařízení se nepodařilo přidat.' })
      if (res.ok) onCreated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">Nové zařízení</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {!fixedKlientId && (
            <div>
              <label className={lbl}>Klient *</label>
              <ClientSelectWithCreate clients={clients} value={form.klientId} onChange={id => set('klientId', id)} />
            </div>
          )}
          <div>
            <label className={lbl}>Název zařízení *</label>
            <input required type="text" value={form.nazev} onChange={e => set('nazev', e.target.value)} placeholder="např. Tepelné čerpadlo Daikin Altherma" className={inp} autoFocus={!!fixedKlientId} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Typ</label>
              <select value={form.typ} onChange={e => set('typ', e.target.value)} className={inp}>
                {Object.entries(ZARIZENI_TYP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Výrobní číslo</label>
              <input type="text" value={form.vyrobniCislo} onChange={e => set('vyrobniCislo', e.target.value)} className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Datum instalace</label>
              <input type="date" value={form.datumInstalace} onChange={e => set('datumInstalace', e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Záruka do</label>
              <input type="date" value={form.zarukaDo} onChange={e => set('zarukaDo', e.target.value)} className={inp} />
            </div>
          </div>
          <div>
            <label className={lbl}>Poznámka</label>
            <textarea value={form.poznamka} onChange={e => set('poznamka', e.target.value)} rows={2} className={inp} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">Zrušit</button>
            <button type="submit" disabled={saving || !form.klientId || !form.nazev.trim()} className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-white rounded-lg font-medium disabled:opacity-50">
              {saving ? 'Ukládám…' : 'Uložit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
