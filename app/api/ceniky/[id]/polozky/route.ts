import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// POST - add product to ceník
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const cenik = await prisma.cenik.findFirst({ where: { id: params.id, orgId } })
  if (!cenik) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { productId, cena } = await req.json()
  if (!productId || cena === undefined) return NextResponse.json({ error: 'productId a cena jsou povinné' }, { status: 400 })

  const product = await prisma.product.findFirst({ where: { id: productId, orgId } })
  if (!product) return NextResponse.json({ error: 'Produkt nenalezen' }, { status: 404 })

  const polozka = await prisma.cenikPolozka.upsert({
    where: { cenikId_productId: { cenikId: params.id, productId } },
    update: { cena: Number(cena) },
    create: { cenikId: params.id, productId, cena: Number(cena) },
    include: { product: { select: { id: true, kod: true, nazev: true, jednotka: true, standardniCena: true, categories: { select: { id: true, nazev: true, barva: true } } } } },
  })
  return NextResponse.json(polozka, { status: 201 })
}
