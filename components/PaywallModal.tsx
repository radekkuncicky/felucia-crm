'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTrialStatus } from '@/hooks/useTrialStatus'

const PLANS = [
  { plan: 'STARTER', label: 'Starter', price: '49 Kč', desc: '1 uživatel' },
  { plan: 'STANDARD', label: 'Standard', price: '999 Kč', desc: '2–5 uživatelů + AI', popular: true },
  { plan: 'PROFESSIONAL', label: 'Professional', price: '1 499 Kč', desc: '5–20 uživatelů' },
]

export function PaywallModal() {
  const status = useTrialStatus()
  const pathname = usePathname()
  const [loading, setLoading] = useState<string | null>(null)

  if (!status) return null
  if (status.isExempt) return null
  if (!status.trialExpired || status.subscriptionActive) return null
  if (pathname.startsWith('/settings/billing') || pathname.startsWith('/auth')) return null

  async function handlePlan(plan: string) {
    setLoading(plan)
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/85 dark:bg-black/90">
      <div className="bg-white dark:bg-[#0D1A0E] rounded-[20px] p-10 max-w-[560px] w-full text-center border border-[rgba(76,175,80,0.2)]">

        {/* Icon */}
        <div className="w-14 h-14 rounded-[14px] bg-[#4CAF50] mx-auto mb-5 flex items-center justify-center">
          <svg width="28" height="28" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
            <path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h2 className="font-bold text-2xl text-[#1A2E1B] dark:text-[#E8F5E9] mb-2">
          Zkušební verze skončila
        </h2>
        <p className="text-sm text-[#6B8C6B] dark:text-[#7aaa7a] leading-relaxed mb-8 max-w-sm mx-auto">
          Vyberte plán a pokračujte v práci. Vaše data jsou v bezpečí a čekají na vás.
        </p>

        {/* Plan cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {PLANS.map(({ plan, label, price, desc, popular }) => (
            <button
              key={plan}
              onClick={() => handlePlan(plan)}
              disabled={!!loading}
              className={[
                'relative rounded-xl p-4 text-center transition-all disabled:cursor-wait',
                loading && loading !== plan ? 'opacity-60' : '',
                popular
                  ? 'border-2 border-[#4CAF50] bg-[rgba(76,175,80,0.05)] dark:bg-[rgba(76,175,80,0.08)]'
                  : 'border border-[#C8E6C9] dark:border-[rgba(76,175,80,0.15)] bg-white dark:bg-[#0A120A]',
              ].join(' ')}
            >
              {popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#4CAF50] text-white text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase whitespace-nowrap">
                  Nejoblíbenější
                </div>
              )}
              <div className="font-bold text-sm text-[#1A2E1B] dark:text-[#E8F5E9] mb-1">
                {label}
              </div>
              <div className="text-lg font-bold text-[#4CAF50] mb-1">
                {loading === plan ? 'Načítám…' : price}
              </div>
              <div className="text-[11px] text-[#6B8C6B] dark:text-[#7aaa7a]">{desc}</div>
            </button>
          ))}
        </div>

        <button
          onClick={() => { window.location.href = '/api/auth/signout' }}
          className="text-sm text-[#6B8C6B] dark:text-[#7aaa7a] underline cursor-pointer bg-transparent border-none hover:opacity-80"
        >
          Odhlásit se
        </button>

        <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-4">
          Potřebujete pomoc? Napište nám na{' '}
          <a href="mailto:info@felucia.io" className="underline">
            info@felucia.io
          </a>
        </p>
      </div>
    </div>
  )
}
