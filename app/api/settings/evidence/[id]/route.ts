import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms } from '@/lib/permissions'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).nastaveniOrg) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const field = await db.customField.findFirst({ where: { id: params.id, orgId } })
  if (!field) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const updated = await db.customField.update({
    where: { id: params.id },
    data: {
      nazev: body.nazev ?? undefined,
      typ: body.typ ?? undefined,
      povinne: body.povinne ?? undefined,
      povinneOdStavu: body.povinneOdStavu !== undefined ? (body.povinneOdStavu || null) : undefined,
      aktivni: body.aktivni ?? undefined,
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).nastaveniOrg) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const field = await db.customField.findFirst({ where: { id: params.id, orgId } })
  if (!field) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.customField.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
