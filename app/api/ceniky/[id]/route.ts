import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const cenik = await prisma.cenik.findFirst({
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
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId

  const cenik = await prisma.cenik.findFirst({ where: { id: params.id, orgId } })
  if (!cenik) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const updated = await prisma.cenik.update({
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
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId

  const cenik = await prisma.cenik.findFirst({ where: { id: params.id, orgId } })
  if (!cenik) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.cenik.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
