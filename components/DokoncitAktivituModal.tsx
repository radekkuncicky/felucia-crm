'use client'

import { useState } from 'react'
import { ActivityTypeIcon } from '@/components/ui/ActivityTypeIcon'

/**
 * Dialog po kliknutí na HOTOVO: volitelný výsledek + nabídka naplánovat
 * navazující aktivitu (typ + datum + poznámka). Odesílá jeden PATCH
 * s `stav: DOKONCENA` a případně `followUp` — navazující aktivita vznikne
 * na stejném OP/leadu v téže transakci (lib/activityPatch.ts).
 */

const VSECHNY_TYPY = [
  { value: 'HOVOR', label: 'Hovor' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SCHUZKA', label: 'Schůzka' },
  { value: 'UKOL', label: 'Úkol' },
  { value: 'POZNAMKA', label: 'Poznámka' },
]
const LEAD_TYPY = VSECHNY_TYPY.filter(t => t.value === 'HOVOR' || t.value === 'EMAIL')

const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary'

function datumZaDni(dni: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dni)
  // lokální YYYY-MM-DD (toISOString by po půlnoci posunul den)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const RYCHLE_TERMINY = [
  { dni: 1, label: 'Zítra' },
  { dni: 3, label: '+3 dny' },
  { dni: 7, label: '+1 týden' },
  { dni: 14, label: '+2 týdny' },
]

export type DokoncitVysledek = {
  /** aktualizovaná aktivita z API (vč. user/resitel) */
  activity: Record<string, unknown> & { id: string; stav: string; splneno: boolean }
  /** nově naplánovaná navazující aktivita, nebo null */
  followUp: (Record<string, unknown> & { id: string; typ: string; datum: string; popis: string | null }) | null
}

export default function DokoncitAktivituModal({
  act,
  patchUrl,
  jeLead = false,
  extraPatch,
  onClose,
  onDone,
}: {
  act: { id: string; typ: string; popis: string | null; vysledek?: string | null }
  /** `/api/activities/{id}` nebo `/api/deals/{dealId}/activities/{id}` */
  patchUrl: string
  /** aktivita na leadu → navazující jen hovor/e-mail */
  jeLead?: boolean
  /** další pole k uložení spolu s dokončením (z editačního modalu) */
  extraPatch?: Record<string, unknown>
  onClose: () => void
  onDone: (r: DokoncitVysledek) => void
}) {
  const typy = jeLead ? LEAD_TYPY : VSECHNY_TYPY
  const [vysledek, setVysledek] = useState(act.vysledek ?? '')
  const [typ, setTyp] = useState(typy.some(t => t.value === act.typ) ? act.typ : 'HOVOR')
  const [datum, setDatum] = useState(() => datumZaDni(3))
  const [poznamka, setPoznamka] = useState('')
  const [saving, setSaving] = useState<'jen' | 'plan' | null>(null)
  const [error, setError] = useState('')

  async function odeslat(naplanovat: boolean) {
    if (naplanovat && !datum) { setError('Vyberte datum další aktivity'); return }
    setSaving(naplanovat ? 'plan' : 'jen')
    setError('')
    try {
      const res = await fetch(patchUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...extraPatch,
          stav: 'DOKONCENA',
          vysledek: vysledek.trim() || null,
          ...(naplanovat ? { followUp: { typ, datum, popis: poznamka.trim() || null } } : {}),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.error ?? 'Nepodařilo se uložit'); return }
      const { followUp, ...activity } = data
      onDone({ activity, followUp: followUp ?? null })
      onClose()
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
          <ActivityTypeIcon typ={act.typ} className="w-6 h-6" />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white">Aktivita hotová</p>
            {act.popis && <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{act.popis}</p>}
          </div>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Výsledek (volitelné)</label>
            <textarea rows={2} value={vysledek} onChange={e => setVysledek(e.target.value)} className={inp} placeholder="Na čem jste se domluvili…" />
          </div>

          <div className="border border-blue-200 dark:border-blue-800 rounded-xl p-4 bg-blue-50 dark:bg-blue-950/30 space-y-3">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Naplánovat další aktivitu?</p>
            <div className="flex gap-1.5 flex-wrap">
              {typy.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTyp(t.value)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    typ === t.value
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-primary-light'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Datum</label>
              <div className="flex gap-1 flex-wrap mb-1.5">
                {RYCHLE_TERMINY.map(r => {
                  const d = datumZaDni(r.dni)
                  return (
                    <button
                      key={r.dni}
                      type="button"
                      onClick={() => setDatum(d)}
                      className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                        datum === d
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600'
                      }`}
                    >
                      {r.label}
                    </button>
                  )
                })}
              </div>
              <input type="date" value={datum} onChange={e => setDatum(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Poznámka</label>
              <input type="text" value={poznamka} onChange={e => setPoznamka(e.target.value)} className={inp} placeholder="Co je potřeba udělat…" />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between gap-2">
          <button onClick={onClose} disabled={!!saving} className="px-3 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800 disabled:opacity-50">
            Zpět
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => odeslat(false)}
              disabled={!!saving}
              className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg disabled:opacity-50"
            >
              {saving === 'jen' ? 'Ukládám…' : 'Jen hotovo'}
            </button>
            <button
              onClick={() => odeslat(true)}
              disabled={!!saving}
              className="px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50"
            >
              {saving === 'plan' ? 'Ukládám…' : 'Hotovo a naplánovat'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
