import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const deal = await prisma.deal.findFirst({ where: { id: params.id, orgId } })
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { nazev, mnozstvi, cenaZaKus, productId, poznamky } = body

  if (!nazev || !mnozstvi || cenaZaKus === undefined) {
    return NextResponse.json({ error: 'Chybí povinná pole' }, { status: 400 })
  }

  const item = await prisma.quoteItem.create({
    data: {
      dealId: params.id,
      productId: productId || null,
      nazev,
      mnozstvi: Number(mnozstvi),
      cenaZaKus: Number(cenaZaKus),
      poznamky: poznamky || null,
    },
    include: { product: true },
  })

  return NextResponse.json(item, { status: 201 })
}
