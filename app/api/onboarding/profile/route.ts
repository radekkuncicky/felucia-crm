import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = session.user

  const body = await req.json()
  const { jmeno, telefon } = body

  if (!jmeno?.trim()) return NextResponse.json({ error: 'Jméno je povinné' }, { status: 400 })
  if (!telefon?.trim()) return NextResponse.json({ error: 'Telefon je povinný' }, { status: 400 })

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { jmeno: jmeno.trim(), telefon: telefon.trim() },
    }),
    prisma.orgSettings.upsert({
      where: { orgId },
      update: { obchodnikJmeno: jmeno.trim(), obchodnikTelefon: telefon.trim() },
      create: { orgId, obchodnikJmeno: jmeno.trim(), obchodnikTelefon: telefon.trim() },
    }),
    prisma.organization.update({
      where: { id: orgId },
      data: { onboardingStep: 2 },
    }),
  ])

  return NextResponse.json({ ok: true })
}
