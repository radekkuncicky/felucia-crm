import { getServerSession } from 'next-auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).nastaveniOrg) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const cat = await db.category.findFirst({ where: { id: params.id, orgId } })
  if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const updated = await db.category.update({
    where: { id: params.id },
    data: {
      nazev: body.nazev ?? cat.nazev,
      barva: body.barva ?? cat.barva,
      poradi: body.poradi !== undefined ? body.poradi : cat.poradi,
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).nastaveniOrg) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const cat = await db.category.findFirst({ where: { id: params.id, orgId } })
  if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // M2M join is cascade-deleted automatically
  await db.category.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
