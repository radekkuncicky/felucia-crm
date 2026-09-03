import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms } from '@/lib/permissions'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const cenik = await db.cenik.findFirst({
    where: { id: params.id, orgId },
    include: {
      polozky: {
        include: { product: { select: { id: true, kod: true, nazev: true, jednotka: true, standardniCena: true, categories: { select: { id: true, nazev: true, barva: true } } } } },
        orderBy: { product: { nazev: 'asc' } },
      },
    },
  })
  if (!cenik) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(cenik)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).nastaveniOrg) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const cenik = await db.cenik.findFirst({ where: { id: params.id, orgId } })
  if (!cenik) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const updated = await db.cenik.update({
    where: { id: params.id },
    data: {
      nazev: body.nazev ?? cenik.nazev,
      popis: body.popis !== undefined ? (body.popis || null) : cenik.popis,
      aktivni: body.aktivni !== undefined ? body.aktivni : cenik.aktivni,
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).nastaveniOrg) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const cenik = await db.cenik.findFirst({ where: { id: params.id, orgId } })
  if (!cenik) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.cenik.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
