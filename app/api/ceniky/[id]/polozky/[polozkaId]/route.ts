import { getServerSession } from 'next-auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request, { params }: { params: { id: string; polozkaId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).nastaveniOrg) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const cenik = await db.cenik.findFirst({ where: { id: params.id, orgId } })
  if (!cenik) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { cena } = await req.json()
  const updated = await db.cenikPolozka.update({
    where: { id: params.polozkaId, cenikId: params.id },
    data: { cena: Number(cena) },
    include: { product: { select: { id: true, nazev: true } } },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string; polozkaId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).nastaveniOrg) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const cenik = await db.cenik.findFirst({ where: { id: params.id, orgId } })
  if (!cenik) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.cenikPolozka.deleteMany({ where: { id: params.polozkaId, cenikId: params.id } })
  return NextResponse.json({ ok: true })
}
