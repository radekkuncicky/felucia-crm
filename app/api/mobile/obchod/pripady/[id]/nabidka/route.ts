import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { generateQuoteKod } from '@/lib/quoteKod'
import { createWithUniqueKod } from '@/lib/uniqueKod'
import { quoteCelkemBezDph } from '@/lib/quoteMath'

type NabidkaItem = {
  productId?: string | null
  nazev?: string
  mnozstvi?: number
  jednotka?: string
  cenaZaKus?: number
  sleva?: number
  poznamky?: string | null
}

const MAX_ITEMS = 200

/**
 * Validace položek: množství > 0, sleva 0–100 %. Záporná cenaZaKus je povolená
 * jen u řádků bez productId — tak appka řeší celkovou slevu v Kč (řádek „Sleva").
 */
function validujItems(items: NabidkaItem[]): string | null {
  if (!Array.isArray(items) || items.length === 0) return 'Nabídka musí mít alespoň jednu položku'
  if (items.length > MAX_ITEMS) return `Maximálně ${MAX_ITEMS} položek`
  for (const item of items) {
    if (!item.nazev?.trim() && !item.productId) return 'Položka musí mít název nebo productId'
    if (isNaN(Number(item.mnozstvi)) || Number(item.mnozstvi) <= 0) {
      return `Neplatné množství pro položku: ${item.nazev ?? item.productId}`
    }
    const cena = Number(item.cenaZaKus)
    if (isNaN(cena)) return `Neplatná cena pro položku: ${item.nazev ?? item.productId}`
    if (cena < 0 && item.productId) return `Záporná cena je povolená jen u volných řádků (sleva): ${item.nazev}`
    const sleva = Number(item.sleva ?? 0)
    if (isNaN(sleva) || sleva < 0 || sleva > 100) return `Neplatná sleva pro položku: ${item.nazev}`
  }
  return null
}

// POST /api/mobile/obchod/pripady/[id]/nabidka — nová varianta nabídky z konfigurátoru.
// { nazev?, dphSazba? (12|21), platnostDo?, items: [...] }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId } = session!.user
  const db = orgPrisma(orgId)

  const deal = await db.deal.findFirst({ where: { id: params.id }, select: { id: true } })
  if (!deal) return NextResponse.json({ error: 'Případ nenalezen' }, { status: 404 })

  let body: { nazev?: string; dphSazba?: number; platnostDo?: string; items?: NabidkaItem[] }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Neplatný požadavek' }, { status: 400 })
  }

  const dphSazba = Number(body.dphSazba ?? 12)
  if (dphSazba !== 12 && dphSazba !== 21) {
    return NextResponse.json({ error: 'DPH sazba musí být 12 nebo 21' }, { status: 400 })
  }
  const items = body.items ?? []
  const chyba = validujItems(items)
  if (chyba) return NextResponse.json({ error: chyba }, { status: 400 })

  // Doplň název/jednotku/nákupní cenu z katalogu (snapshot pro pozdější marži)
  const productIds = Array.from(new Set(items.map(i => i.productId).filter((x): x is string => !!x)))
  const produkty = productIds.length
    ? await db.product.findMany({ where: { id: { in: productIds } } })
    : []
  const produktMapa = new Map(produkty.map(p => [p.id, p]))
  for (const id of productIds) {
    if (!produktMapa.has(id)) return NextResponse.json({ error: 'Produkt nenalezen v katalogu' }, { status: 404 })
  }

  const count = await db.quote.count({ where: { dealId: deal.id } })
  const nazev = body.nazev?.trim() || `Varianta ${count + 1}`

  const quote = await createWithUniqueKod(() => generateQuoteKod(orgId), kod =>
    db.quote.create({
      data: {
        orgId,
        dealId: deal.id,
        kod,
        nazev,
        dphSazba,
        aktivni: count === 0, // první varianta na OP je rovnou aktivní
        platnostDo: body.platnostDo ? new Date(body.platnostDo) : null,
      },
    }),
  )

  await db.quoteItem.createMany({
    data: items.map((item, idx) => {
      const produkt = item.productId ? produktMapa.get(item.productId) : undefined
      return {
        dealId: deal.id,
        quoteId: quote.id,
        productId: item.productId ?? null,
        kod: produkt?.kod ?? null,
        nazev: item.nazev?.trim() || produkt?.nazev || '',
        mnozstvi: Number(item.mnozstvi),
        jednotka: item.jednotka?.trim() || produkt?.jednotka || 'ks',
        cenaZaKus: Number(item.cenaZaKus),
        nakupniCena: produkt?.nakladovaCena ?? null,
        sleva: Number(item.sleva ?? 0),
        dphSazba,
        poznamky: item.poznamky ?? null,
        poradi: idx,
      }
    }),
  })

  const ulozene = await db.quoteItem.findMany({ where: { quoteId: quote.id }, orderBy: { poradi: 'asc' } })
  return NextResponse.json({
    id: quote.id,
    kod: quote.kod,
    nazev: quote.nazev,
    aktivni: quote.aktivni,
    dphSazba,
    celkemBezDph: Math.round(quoteCelkemBezDph(ulozene) * 100) / 100,
  }, { status: 201 })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
