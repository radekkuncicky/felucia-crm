import { getServerSession } from 'next-auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).nastaveniOrg) return forbidden()
  const { orgId } = session.user

  const body = await req.json()
  const { nazev, ico, dic, sidlo } = body

  if (!nazev?.trim()) return NextResponse.json({ error: 'Název firmy je povinný' }, { status: 400 })

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      nazev: nazev.trim(),
      ico: ico?.trim() || null,
      dic: dic?.trim() || null,
      sidlo: sidlo?.trim() || null,
      onboardingStep: 1,
    },
  })

  return NextResponse.json({ ok: true })
}
