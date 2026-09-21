'use client'

import { useState, useEffect } from 'react'
import {
  KONTROLNI_KONTAKT_CIL, KONTROLNI_KONTAKT_DNI, zaPracovnichDni, toDateInputValue,
  kontrolniKontaktPopis, type KontrolniKontaktTyp,
} from '@/lib/kontrolniKontakt'

interface Props {
  /** OP, na které se aktivita naplánuje */
  dealId: string
  quoteKod: string | null
  onClose: () => void
  onSuccess?: () => void
}

/**
 * Kontrolní kontakt k nabídce — samostatná akce (tlačítko v liště nabídky), ne dotaz
 * po každém odeslání. Předvolba: hovor za 3 pracovní dny v 09:00, řešitel = já.
 */
export default function KontrolniKontaktModal({ dealId, quoteKod, onClose, onSuccess }: Props) {
  const [typ, setTyp] = useState<KontrolniKontaktTyp>('HOVOR')
  const [datum, setDatum] = useState(() => toDateInputValue(zaPracovnichDni(KONTROLNI_KONTAKT_DNI)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  async function naplanovat() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/deals/${dealId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typ,
          datum,
          cas: '09:00',
          popis: kontrolniKontaktPopis(quoteKod, typ),
          cil: KONTROLNI_KONTAKT_CIL,
          reminderAt: new Date(`${datum}T09:00:00`).toISOString(),
        }),
      })
      if (!res.ok) {
        setError('Kontrolní kontakt se nepodařilo naplánovat')
        return
      }
      onSuccess?.()
      onClose()
    } catch {
      setError('Kontrolní kontakt se nepodařilo naplánovat')
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white'

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 md:p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-slate-800 rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 dark:border-slate-700 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
              <svg className="text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">Kontrolní kontakt</h3>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                Kdy se klientovi ozvete k nabídce{quoteKod ? ` ${quoteKod}` : ''}?
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-0.5 rounded mt-0.5" aria-label="Zavřít">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="flex gap-2 mb-4">
            <select value={typ} onChange={e => setTyp(e.target.value as KontrolniKontaktTyp)} className={`${inputCls} w-auto flex-shrink-0`}>
              <option value="HOVOR">Hovor</option>
              <option value="EMAIL">E-mail</option>
            </select>
            <input type="date" value={datum} onChange={e => setDatum(e.target.value)} className={inputCls} />
          </div>
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-500 dark:text-slate-400 hover:underline">
              Zrušit
            </button>
            <button
              onClick={naplanovat}
              disabled={saving || !datum}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl disabled:opacity-40"
            >
              {saving ? 'Ukládám…' : 'Naplánovat'}
            </button>
          </div>
        </div>
        <div className="h-2 md:h-0 pb-safe" />
      </div>
    </div>
  )
}
