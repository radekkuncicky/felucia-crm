'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Predavak {
  id: string
  cislo: string
  technikJmeno: string
  schvaleno: string | null
  polozkyCount: number
}

interface Zakazka {
  id: string
  cislo: string
  nazev: string
  klient: { jmeno: string; prijmeni: string }
  predavaky: Predavak[]
}

export default function GenerujVyuctovaniClient({ zakazka, etapaId }: { zakazka: Zakazka; etapaId?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generovat(predavakId?: string) {
    const key = predavakId ?? 'zakazka'
    setLoading(key)
    setError(null)
    try {
      const body: Record<string, string> = {}
      if (predavakId) body.predavakId = predavakId
      if (etapaId) body.etapaId = etapaId
      const res = await fetch(`/api/zakazky/${zakazka.id}/vyuctovani`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const v = await res.json()
        router.push(`/zakazky/${zakazka.id}/vyuctovani/${v.id}`)
      } else {
        const err = await res.json()
        setError(err.error ?? 'Chyba při generování vyúčtování')
      }
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-4">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Generovat vyúčtování</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{zakazka.nazev} · {zakazka.klient.jmeno} {zakazka.klient.prijmeni}</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {zakazka.predavaky.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Z předávacího protokolu (PP)</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Vyúčtování bude vygenerováno ze schválených položek zvoleného protokolu.
            </p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {zakazka.predavaky.map(pp => (
              <div key={pp.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono font-bold text-sm text-gray-900 dark:text-white">{pp.cislo}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    {pp.technikJmeno}
                    {pp.polozkyCount > 0 && ` · ${pp.polozkyCount} pol.`}
                    {pp.schvaleno && ` · Schválen ${new Date(pp.schvaleno).toLocaleDateString('cs-CZ')}`}
                  </p>
                </div>
                <button
                  onClick={() => generovat(pp.id)}
                  disabled={!!loading}
                  className="text-sm font-medium text-white bg-primary hover:bg-primary-hover px-3 py-2 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {loading === pp.id ? 'Generuji…' : 'Generovat'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Ze základních položek zakázky</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Vyúčtování bude vygenerováno ze všech položek zakázky s jejich cenami.
            </p>
          </div>
          <button
            onClick={() => generovat()}
            disabled={!!loading}
            className="text-sm font-medium text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            {loading === 'zakazka' ? 'Generuji…' : 'Generovat'}
          </button>
        </div>
      </div>

      {zakazka.predavaky.length === 0 && (
        <div className="text-center py-6 text-sm text-gray-400 dark:text-slate-500">
          Žádné schválené předávací protokoly. Vyúčtování lze generovat ze základních položek zakázky.
        </div>
      )}
    </div>
  )
}
