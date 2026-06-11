import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getPlanLimits } from '@/lib/planLimits'
import BillingClient from '@/components/BillingClient'
import { Suspense } from 'react'

export default async function BillingPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/dashboard')
  const orgId = session.user.orgId

  const [org, userCount, dealCount] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        plan: true,
        planActiveTo: true,
        aiTokensUsed: true,
        stripeCustomerId: true,
        stripePlanId: true,
        stripeSubscriptionStatus: true,
        stripeCurrentPeriodEnd: true,
        trialEndsAt: true,
        slug: true,
      },
    }),
    prisma.user.count({ where: { orgId, aktivni: true } }),
    prisma.deal.count({ where: { orgId } }),
  ])

  const currentPlan = org?.plan ?? 'STARTER'
  const planLimits = getPlanLimits(currentPlan)
  const now = new Date()
  const trialActive = !!(org?.trialEndsAt && org.trialEndsAt > now && !org?.stripePlanId)
  const trialDaysLeft = org?.trialEndsAt
    ? Math.max(0, Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  // Convert Infinity to -1 for safe client serialization
  const toSafeInt = (v: number) => (v === Infinity ? -1 : v)

  // currentPeriodEnd: prefer stripeCurrentPeriodEnd, fallback to planActiveTo
  const currentPeriodEnd =
    org?.stripeCurrentPeriodEnd?.toISOString() ?? org?.planActiveTo?.toISOString() ?? null

  return (
    <Suspense fallback={null}>
      <BillingClient
        currentPlan={currentPlan}
        userCount={userCount}
        dealCount={dealCount}
        aiUsed={org?.aiTokensUsed ?? 0}
        maxUsers={toSafeInt(planLimits.maxUsers)}
        maxDeals={toSafeInt(planLimits.maxDeals)}
        maxAiTokens={toSafeInt(planLimits.aiTokensPerMonth)}
        canUseAI={planLimits.canUseAI}
        stripeCustomerId={org?.stripeCustomerId ?? null}
        subscriptionStatus={org?.stripeSubscriptionStatus ?? null}
        currentPeriodEnd={currentPeriodEnd}
        trialActive={trialActive}
        trialDaysLeft={trialDaysLeft}
        orgSlug={org?.slug ?? ''}
      />
    </Suspense>
  )
}
