import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { mobileDealScope, getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { quoteCelkemBezDph, quoteCelkemSDph } from '@/lib/quoteMath'

// GET /api/mobile/obchod/nabidka/[id] — detail varianty vč. položek.
// nakupniCena je v odpovědi jen tady (endpoint pro obchodníka) — appka ji
// zobrazuje výhradně za přepínačem „režim obchodníka", nikdy v náhledu pro klienta.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const db = orgPrisma(session!.user.orgId)
  const quote = await db.quote.findFirst({
    where: { id: params.id, deal: mobileDealScope(session!) },
    include: {
      items: { orderBy: { poradi: 'asc' } },
      deal: { select: { id: true, kod: true, predmet: true } },
    },
  })
  if (!quote) return NextResponse.json({ error: 'Nabídka nenalezena' }, { status: 404 })

  return NextResponse.json({
    id: quote.id,
    kod: quote.kod,
    nazev: quote.nazev,
    aktivni: quote.aktivni,
    dphSazba: quote.dphSazba,
    platnostDo: quote.platnostDo,
    odeslanoAt: quote.odeslanoAt,
    odeslanoKanal: quote.odeslanoKanal,
    pripad: quote.deal,
    celkemBezDph: Math.round(quoteCelkemBezDph(quote.items) * 100) / 100,
    celkemSDph: Math.round(quoteCelkemSDph(quote.items, quote.dphSazba) * 100) / 100,
    items: quote.items.map(i => ({
      id: i.id,
      productId: i.productId,
      kod: i.kod,
      nazev: i.nazev,
      mnozstvi: Number(i.mnozstvi),
      jednotka: i.jednotka,
      cenaZaKus: Number(i.cenaZaKus),
      nakupniCena: session!.user.perms.financeNakupky && i.nakupniCena != null ? Number(i.nakupniCena) : null,
      sleva: Number(i.sleva),
      poznamky: i.poznamky,
      poradi: i.poradi,
    })),
  })
}

type NabidkaItem = {
  productId?: string | null
  kod?: string | null
  nazev?: string
  mnozstvi?: number
  jednotka?: string
  cenaZaKus?: number
  sleva?: number
  poznamky?: string | null
}

// PATCH /api/mobile/obchod/nabidka/[id] — přejmenování, DPH, platnost,
// aktivace varianty (deaktivuje sourozence), případně kompletní náhrada položek.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId } = session!.user
  const db = orgPrisma(orgId)
  const quote = await db.quote.findFirst({ where: { id: params.id, deal: mobileDealScope(session!) } })
  if (!quote) return NextResponse.json({ error: 'Nabídka nenalezena' }, { status: 404 })

  let body: {
    nazev?: string
    dphSazba?: number
    platnostDo?: string | null
    aktivni?: boolean
    items?: NabidkaItem[]
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Neplatný požadavek' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (typeof body.nazev === 'string' && body.nazev.trim()) data.nazev = body.nazev.trim()
  if (body.dphSazba !== undefined) {
    const dph = Number(body.dphSazba)
    if (dph !== 12 && dph !== 21) return NextResponse.json({ error: 'DPH sazba musí být 12 nebo 21' }, { status: 400 })
    data.dphSazba = dph
  }
  if (body.platnostDo !== undefined) {
    data.platnostDo = body.platnostDo ? new Date(body.platnostDo) : null
  }
  if (body.aktivni === true) {
    await db.quote.updateMany({ where: { dealId: quote.dealId, id: { not: quote.id } }, data: { aktivni: false } })
    data.aktivni = true
  } else if (body.aktivni === false) {
    data.aktivni = false
  }

  if (Array.isArray(body.items)) {
    for (const item of body.items) {
      if (isNaN(Number(item.mnozstvi)) || Number(item.mnozstvi) <= 0) {
        return NextResponse.json({ error: `Neplatné množství pro položku: ${item.nazev}` }, { status: 400 })
      }
      const cena = Number(item.cenaZaKus)
      if (isNaN(cena)) return NextResponse.json({ error: `Neplatná cena pro položku: ${item.nazev}` }, { status: 400 })
      if (cena < 0 && item.productId) {
        return NextResponse.json({ error: `Záporná cena je povolená jen u volných řádků: ${item.nazev}` }, { status: 400 })
      }
      const sleva = Number(item.sleva ?? 0)
      if (isNaN(sleva) || sleva < 0 || sleva > 100) {
        return NextResponse.json({ error: `Neplatná sleva pro položku: ${item.nazev}` }, { status: 400 })
      }
    }

    const productIds = Array.from(new Set(body.items.map(i => i.productId).filter((x): x is string => !!x)))
    const produkty = productIds.length ? await db.product.findMany({ where: { id: { in: productIds } } }) : []
    const produktMapa = new Map(produkty.map(p => [p.id, p]))
    for (const id of productIds) {
      if (!produktMapa.has(id)) return NextResponse.json({ error: 'Produkt nenalezen v katalogu' }, { status: 404 })
    }

    const dph = (data.dphSazba as number | undefined) ?? quote.dphSazba
    // Kompletní náhrada položek — appka posílá vždy celý seznam
    await db.quoteItem.deleteMany({ where: { quoteId: quote.id } })
    await db.quoteItem.createMany({
      data: body.items.map((item, idx) => {
        const produkt = item.productId ? produktMapa.get(item.productId) : undefined
        return {
          dealId: quote.dealId,
          quoteId: quote.id,
          productId: item.productId ?? null,
          kod: produkt?.kod ?? item.kod ?? null,
          nazev: item.nazev?.trim() || produkt?.nazev || '',
          mnozstvi: Number(item.mnozstvi),
          jednotka: item.jednotka?.trim() || produkt?.jednotka || 'ks',
          cenaZaKus: Number(item.cenaZaKus),
          nakupniCena: produkt?.nakladovaCena ?? null,
          sleva: Number(item.sleva ?? 0),
          dphSazba: dph,
          poznamky: item.poznamky ?? null,
          poradi: idx,
        }
      }),
    })
  }

  if (Object.keys(data).length > 0) {
    await db.quote.update({ where: { id: quote.id }, data })
  } else if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: 'Žádná pole ke změně' }, { status: 400 })
  }

  const items = await db.quoteItem.findMany({ where: { quoteId: quote.id } })
  const dphSazba = (data.dphSazba as number | undefined) ?? quote.dphSazba
  return NextResponse.json({
    id: quote.id,
    ok: true,
    celkemBezDph: Math.round(quoteCelkemBezDph(items) * 100) / 100,
    celkemSDph: Math.round(quoteCelkemSDph(items, dphSazba) * 100) / 100,
  })
}

// DELETE /api/mobile/obchod/nabidka/[id] — smazání neodeslané varianty
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const db = orgPrisma(session!.user.orgId)
  const quote = await db.quote.findFirst({ where: { id: params.id, deal: mobileDealScope(session!) } })
  if (!quote) return NextResponse.json({ error: 'Nabídka nenalezena' }, { status: 404 })
  if (quote.odeslanoAt) {
    return NextResponse.json({ error: 'Odeslanou nabídku nelze smazat' }, { status: 409 })
  }

  await db.quote.delete({ where: { id: quote.id } })
  return NextResponse.json({ ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
