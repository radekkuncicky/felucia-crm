import { getServerSession } from 'next-auth'
import { canAccessDeal } from '@/lib/zakazkyHelpers'
import { forbidden, getPerms } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { patchActivity } from '@/lib/activityPatch'

export async function PATCH(req: Request, { params }: { params: { id: string; actId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessDeal(session.user, getPerms(session.user), params.id))) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const activity = await db.activity.findFirst({
    where: { id: params.actId, dealId: params.id, deal: { orgId } },
  })
  if (!activity) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const r = await patchActivity(db, orgId, session.user.id, activity, await req.json())
  return NextResponse.json(r.json, { status: r.status })
}

export async function DELETE(req: Request, { params }: { params: { id: string; actId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessDeal(session.user, getPerms(session.user), params.id))) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const activity = await db.activity.findFirst({
    where: { id: params.actId, dealId: params.id, deal: { orgId } },
  })
  if (!activity) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.activity.delete({ where: { id: params.actId } })
  return NextResponse.json({ ok: true })
}
