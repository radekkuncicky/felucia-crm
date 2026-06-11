import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const settings = await prisma.orgSettings.findUnique({ where: { orgId } })
  if (!settings) return NextResponse.json({})

  return NextResponse.json({
    zakazkyDefaultVedouciId: settings.zakazkyDefaultVedouciId,
    zakazkyAutoAssignVedouci: settings.zakazkyAutoAssignVedouci,
    zakazkyAutoVyuctovani: settings.zakazkyAutoVyuctovani,
    zakazkyPrefix: settings.zakazkyPrefix,
    zakazkyDefaultDph: settings.zakazkyDefaultDph,
  })
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orgId = session.user.orgId
  const body = await req.json()
  const { zakazkyDefaultVedouciId, zakazkyAutoAssignVedouci, zakazkyAutoVyuctovani, zakazkyPrefix, zakazkyDefaultDph } = body

  await prisma.orgSettings.upsert({
    where: { orgId },
    update: {
      zakazkyDefaultVedouciId: zakazkyDefaultVedouciId ?? null,
      zakazkyAutoAssignVedouci: zakazkyAutoAssignVedouci ?? false,
      zakazkyAutoVyuctovani: zakazkyAutoVyuctovani ?? true,
      zakazkyPrefix: zakazkyPrefix ?? null,
      zakazkyDefaultDph: zakazkyDefaultDph ?? 12,
    },
    create: {
      orgId,
      zakazkyDefaultVedouciId: zakazkyDefaultVedouciId ?? null,
      zakazkyAutoAssignVedouci: zakazkyAutoAssignVedouci ?? false,
      zakazkyAutoVyuctovani: zakazkyAutoVyuctovani ?? true,
      zakazkyPrefix: zakazkyPrefix ?? null,
      zakazkyDefaultDph: zakazkyDefaultDph ?? 12,
    },
  })

  return NextResponse.json({ ok: true })
}
