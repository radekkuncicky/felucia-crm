import { getServerSession } from 'next-auth'
import { canAccessDeal } from '@/lib/zakazkyHelpers'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { forbidden, getPerms } from '@/lib/permissions'
import { loadProductSnapshots, resolveNakupniCena } from '@/lib/quoteItems'

export async function POST(req: Request, { params }: { params: { id: string; quoteId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessDeal(session.user, getPerms(session.user), params.id))) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const perms = getPerms(session.user)

  const quote = await db.quote.findFirst({
    where: { id: params.quoteId, deal: { id: params.id, orgId } },
  })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  // Bulk support: { items: [...] }
  if (body.items && Array.isArray(body.items)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = body.items

    // Snapshot z knihovny: jednotka (fallback) + nákupní cena pro marži
    const productMap = await loadProductSnapshots(db, items.map(i => i.productId))

    const created = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items.map((item: any) => {
        const product = item.productId ? productMap.get(item.productId) : undefined
        const jednotka = item.jednotka || product?.jednotka || 'ks'
        return db.quoteItem.create({
          data: {
            dealId: params.id,
            quoteId: params.quoteId,
            productId: product ? item.productId : null,
            kod: item.kod || null,
            nazev: item.nazev,
            mnozstvi: Number(item.mnozstvi) || 1,
            jednotka,
            cenaZaKus: Number(item.cenaZaKus) || 0,
            nakupniCena: resolveNakupniCena(item.nakupniCena, product, perms),
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
  const { nazev, mnozstvi, cenaZaKus, productId, kod, sleva, poznamky, poradi, dphSazba, nakupniCena } = body
  let { jednotka } = body

  if (!nazev && nazev !== '') {
    return NextResponse.json({ error: 'Chybí povinná pole' }, { status: 400 })
  }

  const product = productId ? (await loadProductSnapshots(db, [productId])).get(productId) : undefined
  // Fallback: lookup jednotka from product when not provided
  if (!jednotka && product) jednotka = product.jednotka

  const item = await db.quoteItem.create({
    data: {
      dealId: params.id,
      quoteId: params.quoteId,
      productId: product ? productId : null,
      kod: kod || null,
      nazev: nazev || '',
      mnozstvi: Number(mnozstvi) || 1,
      jednotka: jednotka || 'ks',
      cenaZaKus: Number(cenaZaKus) || 0,
      nakupniCena: resolveNakupniCena(nakupniCena, product, perms),
      sleva: Number(sleva) || 0,
      dphSazba: dphSazba != null ? Number(dphSazba) : quote.dphSazba,
      poznamky: poznamky || null,
      poradi: Number(poradi) || 0,
    },
    include: { product: true },
  })

  return NextResponse.json(item, { status: 201 })
}
