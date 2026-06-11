import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const org = await prisma.organization.findUnique({
    where: { id: session.user.orgId },
    select: {
      plan: true,
      trialEndsAt: true,
      trialStartedAt: true,
      stripeCustomerId: true,
      stripePlanId: true,
      stripeCurrentPeriodEnd: true,
      stripeSubscriptionStatus: true,
      slug: true,
    },
  })

  const now = new Date()
  const trialActive = !!(org?.trialEndsAt && org.trialEndsAt > now && !org?.stripePlanId)
  const isExempt = org?.slug === 'nanto' || org?.plan === 'ENTERPRISE'

  return NextResponse.json({
    plan: org?.plan ?? 'STARTER',
    trialEndsAt: org?.trialEndsAt?.toISOString() ?? null,
    trialActive,
    stripeCustomerId: org?.stripeCustomerId ?? null,
    subscriptionStatus: org?.stripeSubscriptionStatus ?? null,
    currentPeriodEnd: org?.stripeCurrentPeriodEnd?.toISOString() ?? null,
    isExempt,
  })
}
