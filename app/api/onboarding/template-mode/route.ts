import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = session.user

  const body = await req.json()
  const singleTemplate: boolean = body.singleTemplate ?? true

  await prisma.$transaction([
    prisma.orgSettings.upsert({
      where: { orgId },
      update: { singleTemplate },
      create: { orgId, singleTemplate },
    }),
    prisma.organization.update({
      where: { id: orgId },
      data: { onboardingStep: 5 },
    }),
  ])

  return NextResponse.json({ ok: true })
}
