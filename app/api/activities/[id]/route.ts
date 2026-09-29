import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { patchActivity } from '@/lib/activityPatch'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(getPerms(session.user).obchod)) return forbidden('Nemáte oprávnění upravovat aktivity')
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const activity = await db.activity.findFirst({
    where: { id: params.id, orgId },
  })
  if (!activity) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (activity.leadId && session.user.plan === 'STARTER') return forbidden('Nedostupné v tomto plánu.')

  const r = await patchActivity(db, orgId, session.user.id, activity, await req.json())
  return NextResponse.json(r.json, { status: r.status })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(getPerms(session.user).obchod)) return forbidden('Nemáte oprávnění upravovat aktivity')
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const activity = await db.activity.findFirst({
    where: { id: params.id, orgId },
  })
  if (!activity) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.activity.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
