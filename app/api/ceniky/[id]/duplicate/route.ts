import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId

  const source = await prisma.cenik.findFirst({
    where: { id: params.id, orgId },
    include: { polozky: true },
  })
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { nazev, kod } = await req.json()
  if (!nazev || !kod) return NextResponse.json({ error: 'Název a kód jsou povinné' }, { status: 400 })

  const exists = await prisma.cenik.findFirst({ where: { orgId, kod } })
  if (exists) return NextResponse.json({ error: 'Kód již existuje' }, { status: 400 })

  const newCenik = await prisma.cenik.create({
    data: {
      orgId,
      kod,
      nazev,
      popis: source.popis,
      polozky: {
        create: source.polozky.map(p => ({ productId: p.productId, cena: p.cena })),
      },
    },
    include: { _count: { select: { polozky: true } } },
  })
  return NextResponse.json(newCenik, { status: 201 })
}
