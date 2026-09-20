import { getServerSession } from 'next-auth'
import { canAccessDeal } from '@/lib/zakazkyHelpers'
import { forbidden, getPerms } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { TypAktivity } from '@prisma/client'
import { createNotification } from '@/lib/createNotification'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessDeal(session.user, getPerms(session.user), params.id))) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const userId = session.user.id

  const deal = await db.deal.findFirst({ where: { id: params.id, orgId } })
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { typ, popis, datum, splneno } = body

  if (!typ || !datum) {
    return NextResponse.json({ error: 'Chybí povinná pole' }, { status: 400 })
  }

  // SECURITY FIX: Verify resitelId (resolver) belongs to the same org to prevent IDOR
  if (body.resitelId) {
    const resitel = await db.user.findFirst({ where: { id: body.resitelId, orgId } })
    if (!resitel) {
      return NextResponse.json({ error: 'Řešitel nebyl nalezen v této organizaci' }, { status: 400 })
    }
  }

  const activity = await db.activity.create({
    data: {
      dealId: params.id,
      userId,
      typ: typ as TypAktivity,
      popis: popis || null,
      datum: new Date(datum),
      cas: body.cas || null,
      trvaniMin: body.trvaniMin != null ? Number(body.trvaniMin) : 15,
      splneno: splneno ?? false,
      cil: body.cil || null,
      vysledek: body.vysledek || null,
      misto: body.misto || null,
      resitelId: body.resitelId || userId,
      reminderAt: body.reminderAt ? new Date(body.reminderAt) : null,
    },
    include: { user: true, resitel: true },
  })

  if (activity.typ === 'UKOL' && activity.resitelId && activity.resitelId !== userId) {
    await createNotification({
      orgId,
      userId: activity.resitelId,
      typ: 'NOVY_UKOL',
      zprava: `Nový úkol: ${(activity.popis ?? activity.typ).slice(0, 60)}`,
      dealId: deal.id,
    })
  }

  return NextResponse.json(activity, { status: 201 })
}
