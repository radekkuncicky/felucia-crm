import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { getOrgSettings } from '@/lib/orgSettings'
import { NextResponse } from 'next/server'
import { logAction } from '@/lib/auditLog'
import { getPlanLimits } from '@/lib/planLimits'
import { getPerms } from '@/lib/permissions'

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
  if (!getPerms(session.user).nastaveniOrg) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { orgId } = session.user
  const db = orgPrisma(orgId)

  const body = await req.json()

  // Whitelist allowed fields to prevent injection
  const allowed = [
    'modulServis', 'modulAnalytiky', 'modulDokumenty', 'modulDasa', 'modulCeniky', 'modulLeady',
    'povinnaAktivitaUOP', 'automatickyServis', 'schvaleniNabidky',
    'notifOpBezAktivity', 'notifBlizkTermin', 'notifNovyOP', 'notifDniBezeAktivity', 'notifNovyLead',
    'defaultDphSazba', 'defaultPlatnostDni', 'zobrazitNakladoveCeny', 'singleTemplate', 'obchodnikJmeno', 'obchodnikTelefon', 'primaryColor',
    'dokumentyStyl', 'dokumentyPaticka', 'dokumentyCislovani', 'dokumentyHeaderHtml', 'dokumentyFooterHtml',
  ] as const

  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) data[key] = body[key]
  }

  if (typeof data.dokumentyStyl === 'string' && !['LINKA', 'PRUH', 'VLASTNI', 'ZADNY'].includes(data.dokumentyStyl)) {
    return NextResponse.json({ error: 'Neplatný styl dokumentů' }, { status: 400 })
  }
  // Vlastní HTML záhlaví/patička jen pro plány s white-labelem
  if ((data.dokumentyStyl === 'VLASTNI' || 'dokumentyHeaderHtml' in data || 'dokumentyFooterHtml' in data)
      && !getPlanLimits(session.user.plan).hasWhiteLabel) {
    return NextResponse.json({ error: 'Vlastní HTML šablona vyžaduje plán PROFESSIONAL' }, { status: 403 })
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
