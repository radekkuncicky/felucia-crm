'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

const PLANS = [
  {
    key: 'STARTER',
    name: 'Starter',
    price: '49 Kč',
    priceNote: '/měsíc bez DPH',
    badge: 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-200',
    features: [
      '1 uživatel',
      '20 obchodních případů',
      '100 produktů',
      '1 šablona nabídky',
      'Subdoména firma.felucia.io',
      'Podpora do 48 h',
    ],
  },
  {
    key: 'STANDARD',
    name: 'Standard',
    price: '999 Kč',
    priceNote: '/měsíc bez DPH',
    badge: 'bg-blue-600 text-white',
    features: [
      '2–5 uživatelů',
      'Neomezené obchodní případy',
      'Všechny šablony + editace',
      'AI asistentka Dáša (500/měs)',
      'Ceníky a analytiky',
      'Podpora do 24 h',
    ],
  },
  {
    key: 'PROFESSIONAL',
    name: 'Professional',
    price: '1 499 Kč',
    priceNote: '/měsíc bez DPH',
    badge: 'bg-green-600 text-white',
    features: [
      '5–20 uživatelů',
      'Vše ze Standard',
      'Servisní modul',
      'AI Dáša neomezená',
      'White-label + API přístup',
      'Prioritní podpora do 4 h',
    ],
  },
  {
    key: 'ENTERPRISE',
    name: 'Enterprise',
    price: 'Individuální',
    priceNote: 'nabídka',
    badge: 'bg-yellow-500 text-white',
    features: [
      '20+ uživatelů',
      'Vše z Professional',
      'Dedikovaný onboarding',
      'SLA garance',
      'Vlastní integrace',
      'Školení týmu',
    ],
  },
]

const PLAN_ORDER: Record<string, number> = {
  STARTER: 0,
  STANDARD: 1,
  PROFESSIONAL: 2,
  ENTERPRISE: 3,
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function pluralDays(n: number) {
  if (n === 1) return 'den'
  if (n >= 2 && n <= 4) return 'dny'
  return 'dní'
}

function ProgressBar({ used, limit }: { used: number; limit: number }) {
  if (limit === -1) {
    return (
      <div className="flex items-center gap-2 mt-1">
        <div className="flex-1 h-2 bg-[#E8F5E9] dark:bg-slate-700 rounded-full" />
        <span className="text-xs text-gray-400 dark:text-slate-500 w-20 text-right">{used} / ∞</span>
      </div>
    )
  }
  const pct = Math.min(100, (used / limit) * 100)
  const color = pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-yellow-400' : 'bg-[#4CAF50]'
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-2 bg-[#E8F5E9] dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 dark:text-slate-500 w-20 text-right">
        {used} / {limit}
      </span>
    </div>
  )
}

function Toast({
  msg,
  type,
  onClose,
}: {
  msg: string
  type: 'ok' | 'err' | 'info'
  onClose: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [onClose])

  const bg =
    type === 'ok' ? 'bg-green-600' : type === 'err' ? 'bg-red-600' : 'bg-gray-600'

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg text-sm font-medium text-white ${bg}`}
    >
      {msg}
      <button onClick={onClose} className="opacity-70 hover:opacity-100 ml-1 text-lg leading-none">
        ×
      </button>
    </div>
  )
}

export interface BillingClientProps {
  currentPlan: string
  userCount: number
  dealCount: number
  aiUsed: number
  maxUsers: number
  maxDeals: number
  maxAiTokens: number
  canUseAI: boolean
  stripeCustomerId: string | null
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  trialActive: boolean
  trialDaysLeft: number
  orgSlug: string
}

export default function BillingClient({
  currentPlan,
  userCount,
  dealCount,
  aiUsed,
  maxUsers,
  maxDeals,
  maxAiTokens,
  canUseAI,
  stripeCustomerId,
  subscriptionStatus,
  currentPeriodEnd,
  trialActive,
  trialDaysLeft,
  orgSlug,
}: BillingClientProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' | 'info' } | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
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

  const currentPlanDef = PLANS.find(p => p.key === currentPlan) ?? PLANS[0]
  const currentPlanOrder = PLAN_ORDER[currentPlan] ?? 0
  const hasActiveSubscription =
    (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') && !!stripeCustomerId

  async function handleCheckout(plan: string) {
    setLoading(plan)
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setToast({ msg: data.error ?? 'Chyba při vytváření platby.', type: 'err' })
        return
      }
      window.location.href = data.url
    } catch {
      setToast({ msg: 'Nepodařilo se připojit k platební bráně.', type: 'err' })
    } finally {
      setLoading(null)
    }
  }

  async function handlePortal() {
    setLoading('portal')
    try {
      const res = await fetch('/api/stripe/create-portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setToast({ msg: data.error ?? 'Chyba při otevírání portálu.', type: 'err' })
        return
      }
      window.location.href = data.url
    } catch {
      setToast({ msg: 'Nepodařilo se otevřít portál.', type: 'err' })
    } finally {
      setLoading(null)
    }
  }

  // Status badge
  let statusNode: React.ReactNode
  if (trialActive) {
    statusNode = (
      <span className="text-amber-600 dark:text-amber-400 font-medium">
        Zkušební verze — zbývá {trialDaysLeft} {pluralDays(trialDaysLeft)}
      </span>
    )
  } else if (currentPlan === 'ENTERPRISE') {
    statusNode = (
      <span className="text-yellow-600 dark:text-yellow-400 font-medium">
        Enterprise — spravováno ručně
      </span>
    )
  } else if (subscriptionStatus === 'active') {
    statusNode = <span className="text-green-600 dark:text-green-400 font-medium">Aktivní</span>
  } else if (subscriptionStatus === 'past_due') {
    statusNode = <span className="text-red-600 dark:text-red-400 font-medium">Platba se nezdařila</span>
  } else if (subscriptionStatus === 'canceled') {
    statusNode = <span className="text-gray-500 font-medium">Zrušeno</span>
  } else {
    statusNode = <span className="text-gray-400 font-medium">Bez předplatného</span>
  }

  if (orgSlug === 'felucia') {
    return (
      <div className="text-center py-6 text-sm text-gray-400 dark:text-slate-500 italic">
        Interní účet — PROFESSIONAL
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fakturace a předplatné</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Správa předplatného vaší organizace
        </p>
      </div>

      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Section 1: Current plan */}
      <div className="rounded-xl border-2 border-[#4CAF50] bg-[rgba(76,175,80,0.04)] dark:bg-[rgba(76,175,80,0.08)] p-6">
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">
          Váš aktuální plán
        </p>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${currentPlanDef.badge}`}>
                {currentPlanDef.name}
              </span>
              {currentPlan !== 'ENTERPRISE' && (
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  {currentPlanDef.price}{' '}
                  <span className="text-sm font-normal text-gray-400">{currentPlanDef.priceNote}</span>
                </span>
              )}
            </div>
            <div className="text-sm text-gray-600 dark:text-slate-400 space-y-0.5">
              <p>Stav: {statusNode}</p>
              {subscriptionStatus === 'active' && currentPeriodEnd && (
                <p>Další platba: <span className="text-gray-700 dark:text-slate-300">{formatDate(currentPeriodEnd)}</span></p>
              )}
              {currentPlan === 'ENTERPRISE' && (
                <p>
                  Kontakt:{' '}
                  <a
                    href="mailto:info@felucia.io"
                    className="text-yellow-600 dark:text-yellow-400 hover:underline"
                  >
                    info@felucia.io
                  </a>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            {trialActive && (
              <button
                onClick={() =>
                  document.getElementById('plan-cards')?.scrollIntoView({ behavior: 'smooth' })
                }
                className="bg-[#4CAF50] hover:bg-[#43A047] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap"
              >
                Vybrat plán a pokračovat →
              </button>
            )}
            {!trialActive && stripeCustomerId && currentPlan !== 'ENTERPRISE' && (
              <button
                onClick={handlePortal}
                disabled={loading === 'portal'}
                className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap disabled:opacity-60"
              >
                {loading === 'portal' ? 'Přesměrování…' : 'Spravovat platby →'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Plan cards */}
      <div id="plan-cards">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Dostupné plány</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map(plan => {
            const isCurrent = plan.key === currentPlan
            const planRank = PLAN_ORDER[plan.key] ?? 0
            const isHigher = planRank > currentPlanOrder
            const isEnterprise = plan.key === 'ENTERPRISE'

            return (
              <div
                key={plan.key}
                className={`relative rounded-xl border-2 p-5 flex flex-col bg-white dark:bg-slate-800 transition-shadow ${
                  isCurrent
                    ? 'border-[#4CAF50] shadow-md shadow-green-100 dark:shadow-green-900/20'
                    : 'border-gray-200 dark:border-slate-700'
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-[#4CAF50] text-white whitespace-nowrap shadow-sm">
                    Váš plán
                  </span>
                )}

                <div className="mb-4">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${plan.badge}`}>
                    {plan.name}
                  </span>
                  <p className="mt-3 text-xl font-bold text-gray-900 dark:text-white">{plan.price}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{plan.priceNote}</p>
                </div>

                <ul className="space-y-2 flex-1 mb-4">
                  {plan.features.map(f => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-gray-600 dark:text-slate-300"
                    >
                      <span className="text-[#4CAF50] mt-0.5 flex-shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="text-center text-sm font-semibold text-[#4CAF50] py-2 border border-[#4CAF50]/30 rounded-lg bg-[rgba(76,175,80,0.05)]">
                    Váš plán ✓
                  </div>
                ) : isEnterprise ? (
                  <a
                    href="mailto:info@felucia.io?subject=Enterprise plán Felucia CRM"
                    className="block text-center text-sm font-semibold text-yellow-700 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-700 rounded-lg py-2 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
                  >
                    Kontaktovat →
                  </a>
                ) : isHigher ? (
                  <button
                    onClick={() => handleCheckout(plan.key)}
                    disabled={!!loading}
                    className="w-full bg-[#4CAF50] hover:bg-[#43A047] disabled:opacity-60 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
                  >
                    {loading === plan.key ? 'Přesměrování…' : 'Upgradovat'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleCheckout(plan.key)}
                    disabled={!!loading}
                    className="w-full border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-60 font-semibold py-2 rounded-lg text-sm transition-colors"
                  >
                    {loading === plan.key ? 'Přesměrování…' : 'Downgradovat'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 3: Usage */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">Využití plánu</h2>
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Uživatelé</p>
            <ProgressBar used={userCount} limit={maxUsers} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Obchodní případy</p>
            <ProgressBar used={dealCount} limit={maxDeals} />
          </div>
          {canUseAI && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                AI dotazy (tento měsíc)
              </p>
              <ProgressBar used={aiUsed} limit={maxAiTokens} />
            </div>
          )}
        </div>
      </div>

      {/* Section 4: Cancel subscription */}
      {hasActiveSubscription && (
        <div
          className="dark:border-[rgba(198,40,40,0.3)]"
          style={{ marginTop: 32, borderTop: '1px solid #FFCDD2', paddingTop: 24 }}
        >
          <button
            onClick={() => setCancelOpen(o => !o)}
            className="dark:text-[#EF9A9A]"
            style={{
              background: 'none',
              border: 'none',
              fontSize: 13,
              color: '#C62828',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>{cancelOpen ? '▲' : '▼'}</span>
            Zrušit předplatné
          </button>

          {cancelOpen && (
            <div
              className="dark:bg-[#1A0A0A] dark:border-[rgba(198,40,40,0.3)] dark:text-[#EF9A9A]"
              style={{
                marginTop: 16,
                padding: 20,
                border: '1px solid #FFCDD2',
                borderRadius: 12,
                background: '#FFF5F5',
              }}
            >
              <p
                className="dark:text-[#EF9A9A]"
                style={{ fontSize: 13, color: '#4A4A4A', lineHeight: 1.7, marginBottom: 16 }}
              >
                Po zrušení zůstanete na aktuálním plánu do konce zaplaceného období. Poté bude
                váš účet omezen na plán Starter. Vaše data zůstanou zachována.
              </p>
              <button
                onClick={async () => {
                  const res = await fetch('/api/stripe/create-portal', { method: 'POST' })
                  const data = await res.json()
                  if (data.url) window.location.href = data.url
                }}
                className="dark:bg-transparent dark:text-[#EF9A9A] dark:border-[#C62828]"
                style={{
                  border: '1px solid #C62828',
                  borderRadius: 8,
                  padding: '8px 20px',
                  background: 'white',
                  color: '#C62828',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Zrušit předplatné →
              </button>
              <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 12 }}>
                Budete přesměrováni do Stripe Customer Portal kde zrušení potvrdíte.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
