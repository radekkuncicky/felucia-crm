'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Props {
  trialDaysLeft: number | null
  trialExpired: boolean
}

export default function TrialBanner({ trialDaysLeft, trialExpired }: Props) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (trialExpired) return // can't dismiss expired
    const key = 'trial_banner_dismissed_until'
    const until = localStorage.getItem(key)
    if (until && new Date(until) > new Date()) {
      setDismissed(true)
    }
  }, [trialExpired])

  function dismiss() {
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    localStorage.setItem('trial_banner_dismissed_until', until)
    setDismissed(true)
  }

  if (dismissed && !trialExpired) return null
  if (trialDaysLeft === null && !trialExpired) return null

  if (trialExpired) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 py-2 px-4 text-sm font-medium bg-red-600 text-white">
        <span>⚠ Zkušební verze vypršela — váš účet je omezen na plán Starter</span>
        <Link href="/settings/billing" className="underline font-bold hover:no-underline">
          Upgradovat →
        </Link>
      </div>
    )
  }

  if ((trialDaysLeft ?? 0) > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 py-2 px-4 text-sm font-medium bg-amber-400 text-amber-900">
        <span>⏱ Zkušební verze — zbývá {trialDaysLeft} {trialDaysLeft === 1 ? 'den' : trialDaysLeft && trialDaysLeft < 5 ? 'dny' : 'dní'}</span>
        <Link href="/settings/billing" className="underline font-semibold hover:no-underline">
          Vybrat plán →
        </Link>
        <button onClick={dismiss} className="ml-2 opacity-70 hover:opacity-100 text-base leading-none">×</button>
      </div>
    )
  }

  return null
}
