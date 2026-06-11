'use client'

import { useEffect, useState } from 'react'

export interface TrialStatus {
  trialExpired: boolean
  daysLeft: number | null
  plan: string
  subscriptionActive: boolean
  isExempt: boolean
}

export function useTrialStatus() {
  const [status, setStatus] = useState<TrialStatus | null>(null)

  useEffect(() => {
    fetch('/api/settings/billing')
      .then(r => r.json())
      .then(data => {
        const now = new Date()
        const trialEnd = data.trialEndsAt ? new Date(data.trialEndsAt) : null
        const trialExpired = trialEnd ? trialEnd < now : false
        const daysLeft =
          trialEnd && !trialExpired
            ? Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : null
        const subscriptionActive = data.subscriptionStatus === 'active'

        setStatus({
          trialExpired,
          daysLeft,
          plan: data.plan,
          subscriptionActive,
          isExempt: !!data.isExempt,
        })
      })
      .catch(() => {})
  }, [])

  return status
}
