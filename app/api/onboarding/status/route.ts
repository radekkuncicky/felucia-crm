import { getServerSession } from 'next-auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).nastaveniOrg) return forbidden()
  const { orgId } = session.user

  const { step } = await req.json()
  if (typeof step !== 'number') return NextResponse.json({ error: 'step required' }, { status: 400 })

  await prisma.organization.update({
    where: { id: orgId },
    data: { onboardingStep: step },
  })

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = session.user

  const [org, categories, user] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { nazev: true, ico: true, onboardingDone: true, onboardingStep: true, trialStartedAt: true, trialEndsAt: true },
    }),
    prisma.category.count({ where: { orgId } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { jmeno: true, telefon: true } }),
  ])

  const now = new Date()
  const trialDaysLeft = org?.trialEndsAt
    ? Math.max(0, Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null
  const trialExpired = org?.trialEndsAt ? org.trialEndsAt < now : false

  return NextResponse.json({
    onboardingDone: org?.onboardingDone ?? false,
    onboardingStep: org?.onboardingStep ?? 0,
    trialDaysLeft,
    trialExpired,
    firmaNazev: org?.nazev ?? '',
    userName: user?.jmeno ?? '',
    categoryCount: categories,
  })
}
