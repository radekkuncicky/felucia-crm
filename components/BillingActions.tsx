'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

interface Props {
  currentPlan: string
  hasStripeCustomer: boolean
  orgSlug: string
}

function Toast({ msg, type, onClose }: { msg: string; type: 'ok' | 'info'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg text-sm font-medium text-white ${type === 'ok' ? 'bg-green-600' : 'bg-gray-500'}`}>
      <span>{msg}</span>
      <button onClick={onClose} className="opacity-70 hover:opacity-100 ml-1">×</button>
    </div>
  )
}

export default function BillingActions({ currentPlan, hasStripeCustomer, orgSlug }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'info' } | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setToast({ msg: 'Předplatné bylo úspěšně aktivováno!', type: 'ok' })
      window.history.replaceState({}, '', '/settings/billing')
    } else if (searchParams.get('canceled') === 'true') {
      setToast({ msg: 'Platba byla zrušena.', type: 'info' })
      window.history.replaceState({}, '', '/settings/billing')
    }
  }, [searchParams])

  // Internal FELUCIA account — no upgrade buttons
  if (orgSlug === 'felucia') {
    return (
      <div className="text-center py-2 text-sm text-gray-400 dark:text-slate-500 italic">
        Interní účet — PROFESSIONAL
      </div>
    )
  }

  async function handleUpgrade(plan: 'STARTER' | 'STANDARD' | 'PROFESSIONAL') {
    setLoading(plan)
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setToast({ msg: data.error ?? 'Chyba při vytváření platby.', type: 'info' })
        return
      }
      window.location.href = data.url
    } catch {
      setToast({ msg: 'Nepodařilo se připojit k platební bráně.', type: 'info' })
    } finally {
      setLoading(null)
    }
  }

  async function handleManageSubscription() {
    setLoading('portal')
    try {
      const res = await fetch('/api/stripe/create-portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setToast({ msg: data.error ?? 'Chyba při otevírání portálu.', type: 'info' })
        return
      }
      window.location.href = data.url
    } catch {
      setToast({ msg: 'Nepodařilo se otevřít portál.', type: 'info' })
    } finally {
      setLoading(null)
    }
  }

  const isPaid = currentPlan === 'STANDARD' || currentPlan === 'PROFESSIONAL' || currentPlan === 'ENTERPRISE'

  // Enterprise — contact sales
  if (currentPlan === 'ENTERPRISE') {
    return (
      <div className="text-center py-3 text-sm text-gray-500 dark:text-slate-400">
        Enterprise plán — správa přes dedikovaného account managera.{' '}
        <a href="mailto:info@felucia.io" className="font-semibold text-green-600 dark:text-green-400 hover:underline">info@felucia.io</a>
      </div>
    )
  }

  return (
    <>
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      {isPaid && hasStripeCustomer ? (
        <button
          onClick={handleManageSubscription}
          disabled={loading === 'portal'}
          className="w-full bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-60 text-gray-800 dark:text-slate-200 font-semibold py-3 rounded-xl text-sm transition-colors"
        >
          {loading === 'portal' ? 'Přesměrování…' : 'Spravovat předplatné →'}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleUpgrade('STANDARD')}
            disabled={!!loading || currentPlan === 'STANDARD'}
            className="bg-[#4CAF50] hover:bg-[#43A047] disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-colors"
          >
            {loading === 'STANDARD' ? 'Přesměrování…' : currentPlan === 'STANDARD' ? 'Aktuální plán' : 'Upgradovat na Standard'}
          </button>
          <button
            onClick={() => handleUpgrade('PROFESSIONAL')}
            disabled={!!loading || currentPlan === 'PROFESSIONAL'}
            className="bg-primary hover:bg-primary-hover disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-colors"
          >
            {loading === 'PROFESSIONAL' ? 'Přesměrování…' : currentPlan === 'PROFESSIONAL' ? 'Aktuální plán' : 'Upgradovat na Professional'}
          </button>
        </div>
      )}
    </>
  )
}
