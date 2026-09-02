import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms } from '@/lib/permissions'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const ceniky = await db.cenik.findMany({
    where: { orgId },
    include: { _count: { select: { polozky: true } } },
    orderBy: { nazev: 'asc' },
  })
  return NextResponse.json(ceniky)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).nastaveniOrg) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const { kod, nazev, popis } = await req.json()
  if (!kod || !nazev) return NextResponse.json({ error: 'Kód a název jsou povinné' }, { status: 400 })

  const exists = await db.cenik.findFirst({ where: { orgId, kod } })
  if (exists) return NextResponse.json({ error: 'Ceník s tímto kódem již existuje' }, { status: 400 })

  const cenik = await db.cenik.create({
    data: { orgId, kod, nazev, popis: popis || null },
    include: { _count: { select: { polozky: true } } },
  })
  return NextResponse.json(cenik, { status: 201 })
}
