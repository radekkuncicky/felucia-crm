import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { getOrgSettings } from '@/lib/orgSettings'
import { NextResponse } from 'next/server'
import { logAction } from '@/lib/auditLog'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = session.user

  const settings = await getOrgSettings(orgId)
  return NextResponse.json(settings)
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { orgId } = session.user
  const db = orgPrisma(orgId)

  const body = await req.json()

  // Whitelist allowed fields to prevent injection
  const allowed = [
    'modulServis', 'modulAnalytiky', 'modulDokumenty', 'modulDasa', 'modulCeniky', 'modulLeady',
    'povinnaAktivitaUOP', 'automatickyServis', 'schvaleniNabidky',
    'notifOpBezAktivity', 'notifBlizkTermin', 'notifNovyOP', 'notifDniBezeAktivity', 'notifNovyLead',
    'defaultDphSazba', 'defaultPlatnostDni', 'zobrazitNakladoveCeny', 'singleTemplate', 'obchodnikJmeno', 'obchodnikTelefon', 'primaryColor',
  ] as const

  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) data[key] = body[key]
  }

  const settings = await db.orgSettings.upsert({
    where: { orgId },
    update: data,
    create: { orgId, ...data },
  })

  await logAction({
    orgId,
    userId: session.user.id,
    typAkce: 'UPDATE',
    typZaznamu: 'Settings',
    zaznamId: orgId,
    zaznamNazev: 'Nastavení organizace',
    zmeny: data,
  })

  return NextResponse.json(settings)
}
