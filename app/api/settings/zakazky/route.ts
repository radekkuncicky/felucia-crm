import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (!perms.zakazkyEdit && !perms.nastaveniOrg) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const settings = await db.orgSettings.findUnique({ where: { orgId } })
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
  if (!getPerms(session.user).nastaveniOrg) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const body = await req.json()
  const { zakazkyDefaultVedouciId, zakazkyAutoAssignVedouci, zakazkyAutoVyuctovani, zakazkyPrefix, zakazkyDefaultDph } = body

  await db.orgSettings.upsert({
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
