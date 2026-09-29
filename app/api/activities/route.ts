import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { getMobileSession } from '@/lib/mobile-auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { leadUzavren, parseTyp, typPovolen } from '@/lib/activities'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions) ?? await getMobileSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const { searchParams } = new URL(req.url)
  const typ = searchParams.get('typ')
  const od = searchParams.get('od')
  const do_ = searchParams.get('do')
  const splneno = searchParams.get('splneno')

  // Jen aktivity OP — tenhle feed čtou mobilní appky, které lead aktivity neznají
  const where: Record<string, unknown> = { orgId, dealId: { not: null } }

  if (typ) where.typ = typ
  if (od || do_) {
    where.datum = {
      ...(od ? { gte: new Date(od) } : {}),
      ...(do_ ? { lte: new Date(do_ + 'T23:59:59') } : {}),
    }
  }
  if (splneno === 'true') where.splneno = true
  if (splneno === 'false') where.splneno = false

  const activities = await db.activity.findMany({
    where,
    include: {
      user: { select: { id: true, jmeno: true } },
      deal: {
        select: {
          id: true,
          predmet: true,
          kod: true,
          client: { select: { id: true, jmeno: true, prijmeni: true } },
        },
      },
    },
    orderBy: { datum: 'desc' },
    take: 500,
  })

  return NextResponse.json(activities)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions) ?? await getMobileSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(getPerms(session.user).obchod)) return forbidden('Nemáte oprávnění zakládat aktivity')
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const body = await req.json()
  const dealId: string | null = body.dealId || null
  const leadId: string | null = body.leadId || null
  const typ = parseTyp(body.typ)
  const datum = body.datum ? new Date(body.datum) : null

  if ((!dealId && !leadId) || (dealId && leadId) || !typ || !datum || isNaN(datum.getTime())) {
    return NextResponse.json({ error: 'Chybí povinná pole' }, { status: 400 })
  }

  if (dealId) {
    const deal = await db.deal.findFirst({ where: { id: dealId, orgId } })
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } else {
    if (session.user.plan === 'STARTER') return NextResponse.json({ error: 'Nedostupné v tomto plánu.' }, { status: 403 })
    const lead = await db.lead.findFirst({ where: { id: leadId!, orgId }, select: { status: true } })
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (leadUzavren(lead.status)) return NextResponse.json({ error: 'Lead je uzavřený' }, { status: 400 })
    if (!typPovolen(typ, { leadId })) {
      return NextResponse.json({ error: 'U leadu lze plánovat jen hovor nebo e-mail' }, { status: 400 })
    }
  }

  if (body.resitelId) {
    const resitel = await db.user.findFirst({ where: { id: body.resitelId, orgId } })
    if (!resitel) return NextResponse.json({ error: 'Řešitel nebyl nalezen' }, { status: 400 })
  }

  const activity = await db.activity.create({
    data: {
      orgId,
      dealId,
      leadId,
      userId: session.user.id,
      resitelId: body.resitelId || session.user.id,
      typ,
      popis: body.popis || null,
      datum,
      cas: body.cas || null,
      cil: body.cil ?? null,
      reminderAt: body.reminderAt ? new Date(body.reminderAt) : null,
      stav: 'PLANOVANA',
    },
    include: {
      user: { select: { id: true, jmeno: true } },
      resitel: { select: { id: true, jmeno: true } },
    },
  })

  return NextResponse.json(activity, { status: 201 })
}
