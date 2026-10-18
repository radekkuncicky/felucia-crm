import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'
import { parseZdroj } from '@/lib/zdrojPoptavky'
import { getOrgSettings } from '@/lib/orgSettings'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = session.user as { plan?: string }
  if (plan === 'STARTER') return NextResponse.json({ error: 'Nedostupné v tomto plánu.' }, { status: 403 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const zdroj = searchParams.get('zdroj')
  const zdrojPoptavkyId = searchParams.get('zdrojPoptavkyId')
  const assignedToId = searchParams.get('assignedToId')
  const search = searchParams.get('search')

  const where: Record<string, unknown> = { orgId }
  if (status) where.status = status
  if (zdroj) where.zdroj = zdroj
  if (zdrojPoptavkyId) where.zdrojPoptavkyId = zdrojPoptavkyId === 'bez' ? null : zdrojPoptavkyId
  if (assignedToId) where.assignedToId = assignedToId
  if (search) {
    where.OR = [
      { jmeno: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { firma: { contains: search, mode: 'insensitive' } },
      { telefon: { contains: search, mode: 'insensitive' } },
    ]
  }

  const leady = await db.lead.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, jmeno: true, email: true } },
      _count: { select: { notes: true } },
    },
    orderBy: { vytvoreno: 'desc' },
  })

  return NextResponse.json(leady)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = session.user as { plan?: string }
  if (plan === 'STARTER') return NextResponse.json({ error: 'Nedostupné v tomto plánu.' }, { status: 403 })
  if (!getPerms(session.user).obchod) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const body = await req.json()
  const zdroj = await parseZdroj(db, orgId, body)
  if (typeof zdroj === 'string') return NextResponse.json({ error: zdroj }, { status: 400 })
  // R11: s modulem KPI je zdroj u ručně zadaného leadu povinný
  if (!zdroj.zdrojPoptavkyId && (await getOrgSettings(orgId)).modulKpi) {
    return NextResponse.json({ error: 'Vyberte, odkud o nás zákazník ví' }, { status: 400 })
  }

  const lead = await db.lead.create({
    data: {
      orgId,
      jmeno: body.jmeno,
      email: body.email || null,
      telefon: body.telefon || null,
      firma: body.firma || null,
      zprava: body.zprava || null,
      zdroj: 'RUCNE',
      status: 'NOVY',
      assignedToId: body.assignedToId || null,
      odhadovanaHodnota: body.odhadovanaHodnota ? parseFloat(body.odhadovanaHodnota) : null,
      tagy: body.tagy || [],
      ...zdroj,
    },
  })

  return NextResponse.json(lead, { status: 201 })
}
