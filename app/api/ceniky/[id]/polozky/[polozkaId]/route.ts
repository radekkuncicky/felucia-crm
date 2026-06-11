import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request, { params }: { params: { id: string; polozkaId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const cenik = await prisma.cenik.findFirst({ where: { id: params.id, orgId } })
  if (!cenik) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { cena } = await req.json()
  const updated = await prisma.cenikPolozka.update({
    where: { id: params.polozkaId },
    data: { cena: Number(cena) },
    include: { product: { select: { id: true, nazev: true } } },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string; polozkaId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const cenik = await prisma.cenik.findFirst({ where: { id: params.id, orgId } })
  if (!cenik) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.cenikPolozka.delete({ where: { id: params.polozkaId } })
  return NextResponse.json({ ok: true })
}
