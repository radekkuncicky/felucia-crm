'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Props {
  onboardingDone: boolean
  onboardingStep: number
}

export default function OnboardingBanner({ onboardingDone, onboardingStep }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (onboardingDone) return

    // Check session dismiss first — don't count this load if already hidden
    if (sessionStorage.getItem('onboarding_banner_hidden')) {
      setDismissed(true)
      return
    }

    // Increment counter on every page load (only when not session-dismissed)
    const count = parseInt(localStorage.getItem('felucia_onboarding_banner_count') || '0', 10)
    const newCount = count + 1
    localStorage.setItem('felucia_onboarding_banner_count', String(newCount))

    if (newCount > 15) {
      setDismissed(true)
      return
    }

    setVisible(true)
  }, [onboardingDone])

  function dismiss() {
    // Only hide for current session — does NOT increment counter
    sessionStorage.setItem('onboarding_banner_hidden', '1')
    setDismissed(true)
  }

  if (onboardingDone || dismissed || !visible) return null

  const remaining = Math.max(0, 7 - onboardingStep)

  return (
    <div
      className="sticky top-0 z-40 flex items-center justify-between gap-3 py-2.5 px-4 text-sm font-medium"
      style={{ background: '#4CAF50', color: 'white' }}
    >
      <span>
        🌿 Dokončete nastavení profilu{remaining > 0 ? ` — zbývá ${remaining} ${remaining === 1 ? 'krok' : remaining < 5 ? 'kroky' : 'kroků'}` : ''}
      </span>
      <div className="flex items-center gap-3">
        <Link
          href="/onboarding"
          className="bg-white text-green-700 font-semibold text-xs px-3 py-1 rounded-lg hover:bg-green-50 transition-colors"
        >
          Dokončit nastavení
        </Link>
        <button onClick={dismiss} className="opacity-80 hover:opacity-100 text-lg leading-none">×</button>
      </div>
    </div>
  )
}
