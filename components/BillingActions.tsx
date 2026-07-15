'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

interface Props {
  currentPlan: string
  hasStripeCustomer: boolean
  orgSlug: string
}

export default function BillingActions({ currentPlan, hasStripeCustomer, orgSlug }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Předplatné bylo úspěšně aktivováno!')
      window.history.replaceState({}, '', '/settings/billing')
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Platba byla zrušena.')
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
        toast.error(data.error ?? 'Platbu se nepodařilo vytvořit.')
        return
      }
      window.location.href = data.url
    } catch {
      toast.error('Nepodařilo se připojit k platební bráně.')
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
        toast.error(data.error ?? 'Zákaznický portál se nepodařilo otevřít.')
        return
      }
      window.location.href = data.url
    } catch {
      toast.error('Zákaznický portál se nepodařilo otevřít.')
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
