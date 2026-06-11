'use client'

import { useSession } from 'next-auth/react'
import { getPlanLimits } from '@/lib/planLimits'

export function usePlanLimits() {
  const { data: session } = useSession()
  const plan = session?.user?.plan ?? 'STARTER'
  const limits = getPlanLimits(plan)
  return { plan, limits }
}
