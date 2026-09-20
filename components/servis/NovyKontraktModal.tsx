'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { SERVIS_TYP_LABELS, type ServisTyp } from './types'

interface ZarizeniItem {
  id: string
  nazev: string
  vyrobniCislo: string | null
  klient: { id: string; jmeno: string; prijmeni: string }
}

interface Props {
  zarizeniList: ZarizeniItem[]
  /** Předvybrané zařízení (z karty zařízení v portfoliu) — hledání se nezobrazuje. */
  zarizeniId?: string
  onClose: () => void
  onCreated: () => void
}

const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500'
const lbl = 'block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1'

// Nový servisní kontrakt (přeneseno ze /servis/kontrakty). Kontrakt = smlouva
// nad zařízením; první návštěvy vygeneruje API (/api/servis/kontrakty POST).
export default function NovyKontraktModal({ zarizeniList, zarizeniId: fixedZarizeniId, onClose, onCreated }: Props) {
  const fixed = fixedZarizeniId ? zarizeniList.find(z => z.id === fixedZarizeniId) ?? null : null
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    zarizeniId: fixed?.id ?? '',
    nazev: fixed ? `${fixed.nazev} – servis` : '',
    typ: 'ROCNI' as ServisTyp,
    cena: '',
    zacatek: new Date().toISOString().split('T')[0],
    autoRenewal: true,
  })

  const filtered = zarizeniList.filter(z =>
    !search || `${z.nazev} ${z.klient.jmeno} ${z.klient.prijmeni} ${z.vyrobniCislo ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  )

  async function submit() {
    if (!form.zarizeniId || !form.nazev.trim()) return
    setSaving(true)
    try {
      const z = zarizeniList.find(z => z.id === form.zarizeniId)
      const res = await api.post('/api/servis/kontrakty', {
        zarizeniId: form.zarizeniId,
        klientId: z?.klient.id,
        nazev: form.nazev.trim(),
        typ: form.typ,
        cena: form.cena ? Number(form.cena) : null,
        zacatek: form.zacatek,
        autoRenewal: form.autoRenewal,
      }, { errorMessage: 'Kontrakt se nepodařilo vytvořit.' })
      if (res.ok) onCreated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nový servisní kontrakt</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className={lbl}>Zařízení *</label>
            {fixed ? (
              <p className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-slate-900/50 rounded-lg px-3 py-2">
                {fixed.nazev} <span className="text-gray-500 dark:text-slate-400">· {fixed.klient.jmeno} {fixed.klient.prijmeni}</span>
              </p>
            ) : (
              <>
                <input
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setForm(f => ({ ...f, zarizeniId: '' })) }}
                  placeholder="Hledat zařízení nebo klienta…"
                  className={`${inp} mb-2`}
                />
                {search && !form.zarizeniId && (
                  <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {filtered.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400">Žádné zařízení nenalezeno</p>
                    ) : filtered.slice(0, 8).map(z => (
                      <button
                        key={z.id}
                        onClick={() => { setForm(f => ({ ...f, zarizeniId: z.id, nazev: `${z.nazev} – servis` })); setSearch(`${z.nazev} (${z.klient.jmeno} ${z.klient.prijmeni})`) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-700 border-b border-gray-100 dark:border-slate-700 last:border-0"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">{z.nazev}</span>
                        <span className="text-gray-500 dark:text-slate-400"> · {z.klient.jmeno} {z.klient.prijmeni}</span>
                        {z.vyrobniCislo && <span className="text-xs text-gray-400 dark:text-slate-500"> · S/N {z.vyrobniCislo}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {form.zarizeniId && <p className="text-xs text-green-600 dark:text-green-400">✓ Zařízení vybráno</p>}
              </>
            )}
          </div>
          <div>
            <label className={lbl}>Název kontraktu *</label>
            <input type="text" value={form.nazev} onChange={e => setForm(f => ({ ...f, nazev: e.target.value }))} placeholder="např. Roční servis TČ" className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Typ</label>
              <select value={form.typ} onChange={e => setForm(f => ({ ...f, typ: e.target.value as ServisTyp }))} className={inp}>
                {Object.entries(SERVIS_TYP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Cena/rok (Kč)</label>
              <input type="number" min="0" value={form.cena} onChange={e => setForm(f => ({ ...f, cena: e.target.value }))} placeholder="např. 3500" className={inp} />
            </div>
          </div>
          <div>
            <label className={lbl}>Začátek</label>
            <input type="date" value={form.zacatek} onChange={e => setForm(f => ({ ...f, zacatek: e.target.value }))} className={inp} />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.autoRenewal} onChange={e => setForm(f => ({ ...f, autoRenewal: e.target.checked }))} className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
            <span className="text-sm text-gray-700 dark:text-slate-300">Automatické obnovení</span>
          </label>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">Zrušit</button>
          <button onClick={submit} disabled={!form.zarizeniId || !form.nazev.trim() || saving} className="px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
            {saving ? 'Vytvářím…' : 'Vytvořit kontrakt'}
          </button>
        </div>
      </div>
    </div>
  )
}
