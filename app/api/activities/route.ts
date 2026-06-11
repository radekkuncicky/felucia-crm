import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMobileSession } from '@/lib/mobile-auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

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

  const where: Record<string, unknown> = {
    deal: { orgId },
  }

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
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const body = await req.json()
  const { dealId, typ, popis, datum, cil } = body

  if (!dealId || !typ || !datum) {
    return NextResponse.json({ error: 'Chybí povinná pole' }, { status: 400 })
  }

  const deal = await db.deal.findFirst({ where: { id: dealId, orgId } })
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const activity = await db.activity.create({
    data: {
      dealId,
      userId: session.user.id,
      typ,
      popis: popis || null,
      datum: new Date(datum),
      cil: cil ?? null,
      stav: 'PLANOVANA',
    },
  })

  return NextResponse.json(activity, { status: 201 })
}
