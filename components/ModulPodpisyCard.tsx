'use client'

import { useState } from 'react'
import { toast } from 'sonner'

interface Props {
  aktivni: boolean
  licence: number
  vyuzito: number
  limit: number
  cenaLicence: number
  vProdeji: boolean
  maPortal: boolean
}

// Karta příplatkového modulu Online podpis smluv (jen plán STANDARD;
// vyšší plány ho mají v ceně a kartu nevidí)
export default function ModulPodpisyCard({ aktivni, licence, vyuzito, limit, cenaLicence, vProdeji, maPortal }: Props) {
  const [loading, setLoading] = useState<string | null>(null)

  async function aktivovat() {
    setLoading('checkout')
    try {
      const res = await fetch('/api/stripe/podpisy-checkout', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Aktivaci se nepodařilo spustit'); return }
      window.location.href = data.url
    } catch {
      toast.error('Aktivaci se nepodařilo spustit')
    } finally {
      setLoading(null)
    }
  }

  async function spravovat() {
    setLoading('portal')
    try {
      const res = await fetch('/api/stripe/create-portal', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.url) window.location.href = data.url
      else toast.error('Portál se nepodařilo otevřít')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="max-w-4xl mt-8 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
      <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">
        Doplňkové moduly
      </p>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-semibold text-gray-900 dark:text-white">Online podpis smluv</span>
            {aktivni ? (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                Aktivní
              </span>
            ) : (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400">
                Neaktivní
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-slate-400 max-w-xl">
            Odesílání smluv klientům k elektronickému podpisu — ověření SMS kódem, podpis prstem,
            auditní stopa a podepsané PDF e-mailem. Až {limit} smluv měsíčně.
          </p>
          <p className="text-sm text-gray-900 dark:text-white font-semibold">
            {cenaLicence} Kč <span className="font-normal text-gray-400 text-xs">/ licence / měsíc</span>
            <span className="font-normal text-gray-400 text-xs"> · vaše organizace: {licence}× licence = {cenaLicence * licence} Kč/měsíc</span>
          </p>
          {aktivni && (
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Tento měsíc využito <strong>{vyuzito} ze {limit}</strong> odeslaných smluv.
            </p>
          )}
        </div>
        <div className="shrink-0">
          {aktivni ? (
            maPortal && (
              <button
                onClick={spravovat}
                disabled={loading === 'portal'}
                className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60"
              >
                {loading === 'portal' ? 'Přesměrování…' : 'Spravovat / zrušit →'}
              </button>
            )
          ) : vProdeji ? (
            <button
              onClick={aktivovat}
              disabled={loading === 'checkout'}
              className="bg-[#4CAF50] hover:bg-[#43A047] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60"
            >
              {loading === 'checkout' ? 'Přesměrování…' : 'Aktivovat modul →'}
            </button>
          ) : (
            <span className="text-xs text-gray-400 dark:text-slate-500">Již brzy</span>
          )}
        </div>
      </div>
    </div>
  )
}
