'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  zakazkaId: string
  stav?: string
  opId?: string | null
  hasServiceModule?: boolean
  role?: string
}

export default function ZakazkaDetailHeader({ zakazkaId, stav, opId, hasServiceModule, role }: Props) {
  const [showServisModal, setShowServisModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const isHotovo = stav === 'HOTOVO'
  const canManager = role === 'ADMIN'

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
        {/* Servis button – only when HOTOVO + service module + manager */}
        {isHotovo && hasServiceModule && canManager && (
          <button
            onClick={() => setShowServisModal(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            + Servisní zakázka
          </button>
        )}

        {/* Delete button – only ADMIN, not when HOTOVO */}
        {canManager && !isHotovo && (
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 px-3 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Smazat
          </button>
        )}
      </div>

      {showServisModal && (
        <ServisModal
          zakazkaId={zakazkaId}
          onClose={() => setShowServisModal(false)}
        />
      )}

      {showDeleteModal && (
        <DeleteModal
          zakazkaId={zakazkaId}
          opId={opId ?? null}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </>
  )
}

function DeleteModal({ zakazkaId, opId, onClose }: { zakazkaId: string; opId: string | null; onClose: () => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/zakazky/${zakazkaId}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Chyba při mazání')
        return
      }
      if (opId) {
        router.push(`/deals/${opId}`)
      } else {
        router.push('/zakazky')
      }
    } catch {
      setError('Nepodařilo se připojit k serveru')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">Smazat zakázku</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div className="flex gap-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-700 dark:text-slate-300">
                Zakázka bude trvale smazána včetně všech položek, předávacích protokolů a vyúčtování.
              </p>
              {opId && (
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Propojené OP zůstane nedotčené — nová zakázka z něj půjde vytvořit znovu.
                </p>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              Zrušit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Mazání…' : 'Smazat zakázku'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ServisModal({ zakazkaId, onClose }: { zakazkaId: string; onClose: () => void }) {
  const router = useRouter()
  const [nazevZarizeni, setNazevZarizeni] = useState('')
  const [typZarizeni, setTypZarizeni] = useState('JINE')
  const [typKontraktu, setTypKontraktu] = useState('JEDNOURAZOVY')
  const [pristiServis, setPristiServis] = useState('')
  const [poznamka, setPoznamka] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ zarizeniId: string; kontraktId: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/zakazky/${zakazkaId}/servis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazevZarizeni, typZarizeni, typKontraktu, pristiServis, poznamka }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Chyba')
        return
      }
      const d = await res.json()
      setDone(d)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">Vytvořit servisní zakázku</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {done ? (
          <div className="px-5 py-6 text-center space-y-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-900 dark:text-white font-medium">Servisní zakázka vytvořena!</p>
            <div className="flex gap-3 justify-center">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg">Zavřít</button>
              <button
                onClick={() => { router.push(`/servis/zarizeni/${done.zarizeniId}`); onClose() }}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg"
              >
                → Přejít na servisní modul
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Název zařízení *</label>
              <input
                type="text"
                value={nazevZarizeni}
                onChange={e => setNazevZarizeni(e.target.value)}
                required
                placeholder="např. Tepelné čerpadlo Daikin"
                className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm"
                style={{ fontSize: 16 }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Typ zařízení</label>
              <select
                value={typZarizeni}
                onChange={e => setTypZarizeni(e.target.value)}
                className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm"
              >
                <option value="TEPELNE_CERPADLO">Tepelné čerpadlo</option>
                <option value="KLIMATIZACE">Klimatizace</option>
                <option value="REKUPERACE">Rekuperace</option>
                <option value="PODLAHOVE_VYTAPENI">Podlahové vytápění</option>
                <option value="VZDUCHOTECHNIKA">Vzduchotechnika</option>
                <option value="OHREV_TV">Ohřev TUV</option>
                <option value="JINE">Jiné</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Typ kontraktu</label>
              <select
                value={typKontraktu}
                onChange={e => setTypKontraktu(e.target.value)}
                className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm"
              >
                <option value="JEDNOURAZOVY">Jednorázový</option>
                <option value="ROCNI">Roční</option>
                <option value="POLOLETNI">Pololetní</option>
                <option value="DVOULETNI">Dvouletní</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Příští servis *</label>
              <input
                type="date"
                value={pristiServis}
                onChange={e => setPristiServis(e.target.value)}
                required
                className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Poznámka</label>
              <textarea
                value={poznamka}
                onChange={e => setPoznamka(e.target.value)}
                rows={2}
                placeholder="Volitelná poznámka k servisní zakázce"
                className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg">Zrušit</button>
              <button type="submit" disabled={loading || !nazevZarizeni.trim() || !pristiServis} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50">
                {loading ? 'Vytváří…' : 'Vytvořit servisní ZAK'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
