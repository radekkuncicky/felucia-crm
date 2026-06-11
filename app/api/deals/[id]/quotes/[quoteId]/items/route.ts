import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: { id: string; quoteId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const quote = await prisma.quote.findFirst({
    where: { id: params.quoteId, deal: { id: params.id, orgId } },
  })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  // Bulk support: { items: [...] }
  if (body.items && Array.isArray(body.items)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = body.items

    // Fetch products for items where jednotka is missing — use product's jednotka as fallback
    const missingUnitIds = Array.from(new Set<string>(
      items
        .filter((i: { productId?: string; jednotka?: string }) => i.productId && !i.jednotka)
        .map((i: { productId: string }) => i.productId)
    ))

    const productMap: Record<string, string> = {}
    if (missingUnitIds.length > 0) {
      const prods = await prisma.product.findMany({
        where: { id: { in: missingUnitIds } },
        select: { id: true, jednotka: true },
      })
      prods.forEach(p => { productMap[p.id] = p.jednotka })
    }

    const created = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items.map((item: any) => {
        const jednotka = item.jednotka || (item.productId ? productMap[item.productId] : undefined) || 'ks'
        return prisma.quoteItem.create({
          data: {
            dealId: params.id,
            quoteId: params.quoteId,
            productId: item.productId || null,
            kod: item.kod || null,
            nazev: item.nazev,
            mnozstvi: Number(item.mnozstvi) || 1,
            jednotka,
            cenaZaKus: Number(item.cenaZaKus) || 0,
            sleva: Number(item.sleva) || 0,
            dphSazba: item.dphSazba != null ? Number(item.dphSazba) : quote.dphSazba,
            poznamky: item.poznamky || null,
            poradi: Number(item.poradi) || 0,
          },
          include: { product: true },
        })
      })
    )
    return NextResponse.json(created, { status: 201 })
  }

  // Single item
  const { nazev, mnozstvi, cenaZaKus, productId, kod, sleva, poznamky, poradi, dphSazba } = body
  let { jednotka } = body

  if (!nazev && nazev !== '') {
    return NextResponse.json({ error: 'Chybí povinná pole' }, { status: 400 })
  }

  // Fallback: lookup jednotka from product when not provided
  if (!jednotka && productId) {
    const prod = await prisma.product.findUnique({ where: { id: productId }, select: { jednotka: true } })
    if (prod) jednotka = prod.jednotka
  }

  const item = await prisma.quoteItem.create({
    data: {
      dealId: params.id,
      quoteId: params.quoteId,
      productId: productId || null,
      kod: kod || null,
      nazev: nazev || '',
      mnozstvi: Number(mnozstvi) || 1,
      jednotka: jednotka || 'ks',
      cenaZaKus: Number(cenaZaKus) || 0,
      sleva: Number(sleva) || 0,
      dphSazba: dphSazba != null ? Number(dphSazba) : quote.dphSazba,
      poznamky: poznamky || null,
      poradi: Number(poradi) || 0,
    },
    include: { product: true },
  })

  return NextResponse.json(item, { status: 201 })
}
