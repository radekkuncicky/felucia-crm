import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import BillingClient from './BillingClient'

export default async function BillingPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isSuperAdmin) redirect('/dashboard')

  const PLAN_PRICES: Record<string, number> = {
    STARTER: 49,
    STANDARD: 999,
    PROFESSIONAL: 1499,
    ENTERPRISE: 0, // individuální
  }

  const orgs = await prisma.organization.findMany({
    where: { plan: { not: 'STARTER' } },
    orderBy: { plan: 'desc' },
    select: {
      id: true,
      nazev: true,
      plan: true,
      aktivni: true,
      planActiveTo: true,
      stripeCustomerId: true,
      stripePlanId: true,
      email: true,
    },
  })

  const planDistribution = await prisma.organization.groupBy({
    by: ['plan'],
    _count: { _all: true },
  })

  const mrr = planDistribution.reduce((sum, g) => sum + g._count._all * (PLAN_PRICES[g.plan] ?? 0), 0)

  return (
    <BillingClient
      mrr={mrr}
      planDistribution={planDistribution.map(g => ({ plan: g.plan, count: g._count._all }))}
      orgs={orgs.map(o => ({
        ...o,
        planActiveTo: o.planActiveTo?.toISOString() ?? null,
        price: PLAN_PRICES[o.plan] ?? 0,
      }))}
    />
  )
}
