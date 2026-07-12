'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatDate } from '@/lib/format'

interface Technik {
  id: string
  jmeno: string
  email: string
  telefon: string | null
  prirazeno: string
}

interface Props {
  zakazkaId: string
  technici: Technik[]
  vsichniTechnici: { id: string; jmeno: string; email: string }[]
  canEdit: boolean
}

export default function TechniciTab({ zakazkaId, technici: initialTechnici, vsichniTechnici, canEdit }: Props) {
  const router = useRouter()
  const [technici, setTechnici] = useState(initialTechnici)
  const [loading, setLoading] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedId, setSelectedId] = useState('')

  const assigned = new Set(technici.map(t => t.id))
  const available = vsichniTechnici.filter(t => !assigned.has(t.id))

  async function handlePridat() {
    if (!selectedId) return
    setLoading('add')
    try {
      const res = await fetch(`/api/zakazky/${zakazkaId}/technici`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technikId: selectedId }),
      })
      if (res.ok) {
        const data = await res.json()
        const technik = vsichniTechnici.find(t => t.id === selectedId)!
        setTechnici(prev => [...prev, { ...technik, telefon: null, prirazeno: new Date().toISOString() }])
        setSelectedId('')
        setShowAdd(false)
        if (data.zakazkaNovyStav === 'PRIRAZENA') {
          toast.success('Technik přiřazen — zakázka automaticky označena jako Přiřazena')
        }
        router.refresh()
      }
    } finally {
      setLoading(null)
    }
  }

  async function handleOdebrat(technikId: string) {
    setLoading(technikId)
    try {
      const res = await fetch(`/api/zakazky/${zakazkaId}/technici/${technikId}`, { method: 'DELETE' })
      if (res.ok) {
        setTechnici(prev => prev.filter(t => t.id !== technikId))
        router.refresh()
      }
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">Přiřazení technici ({technici.length})</h3>
        {canEdit && available.length > 0 && (
          <button
            onClick={() => setShowAdd(o => !o)}
            className="text-sm font-medium text-primary dark:text-primary-light hover:underline"
          >
            + Přiřadit technika
          </button>
        )}
      </div>

      {showAdd && (
        <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="flex-1 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">— vyberte technika —</option>
            {available.map(t => (
              <option key={t.id} value={t.id}>{t.jmeno} ({t.email})</option>
            ))}
          </select>
          <button
            onClick={handlePridat}
            disabled={!selectedId || loading === 'add'}
            className="px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50"
          >
            Přiřadit
          </button>
          <button onClick={() => setShowAdd(false)} className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400">Zrušit</button>
        </div>
      )}

      {technici.length === 0 ? (
        <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">Žádní technici nejsou přiřazeni</div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-slate-700">
          {technici.map(t => (
            <div key={t.id} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-sm flex-shrink-0">
                  {t.jmeno.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{t.jmeno}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{t.email}</p>
                  {t.telefon && <p className="text-xs text-gray-500 dark:text-slate-400">{t.telefon}</p>}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-400 dark:text-slate-500">
                  Přiřazen {formatDate(t.prirazeno)}
                </span>
                {canEdit && (
                  <button
                    onClick={() => handleOdebrat(t.id)}
                    disabled={loading === t.id}
                    className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                  >
                    {loading === t.id ? 'Odebírám…' : 'Odebrat'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
