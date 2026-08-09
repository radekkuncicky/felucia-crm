import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'

type VzorPolozka = {
  product_id?: string | null
  nazev?: string
  mnozstvi?: number
  cena_za_kus?: number
  jednotka?: string
  sleva?: number
  poznamky?: string | null
}

/**
 * GET /api/mobile/obchod/nabidka-vzory?technologie=KLIMA — vzorové nabídky
 * (QuoteTemplate s položkami) pro konfigurátor: obchodník vloží celý vzor
 * a jen doladí. Ceny se berou ze vzoru (ne aktuální katalogové); nákupní
 * cena se dotahuje z katalogu kvůli marži v režimu obchodníka.
 */
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const db = orgPrisma(session!.user.orgId)
  const technologie = new URL(req.url).searchParams.get('technologie')

  const sablony = await db.quoteTemplate.findMany({
    where: technologie
      ? { OR: [{ technologie: technologie as never }, { technologie: null }] }
      : {},
    select: { id: true, nazev: true, popis: true, technologie: true, polozky: true },
    orderBy: { nazev: 'asc' },
  })

  // Vzor = šablona, která má položky (BASE/STANDARD šablony vzhledu přeskočit)
  const vzory = sablony.filter(s => Array.isArray(s.polozky) && (s.polozky as unknown[]).length > 0)

  // Nákupní ceny k položkám s productId (jedním dotazem přes všechny vzory)
  const productIds = Array.from(new Set(
    vzory.flatMap(v => (v.polozky as VzorPolozka[]).map(p => p.product_id).filter((x): x is string => !!x)),
  ))
  const produkty = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, nakladovaCena: true, jednotka: true },
      })
    : []
  const produktMapa = new Map(produkty.map(p => [p.id, p]))

  return NextResponse.json(vzory.map(v => ({
    id: v.id,
    nazev: v.nazev,
    popis: v.popis,
    technologie: v.technologie,
    items: (v.polozky as VzorPolozka[]).map(p => {
      const produkt = p.product_id ? produktMapa.get(p.product_id) : undefined
      return {
        // Produkt mezitím smazaný z katalogu → volný řádek se vzorovou cenou
        productId: produkt ? p.product_id : null,
        nazev: p.nazev ?? '',
        mnozstvi: Number(p.mnozstvi) || 1,
        jednotka: p.jednotka || produkt?.jednotka || 'ks',
        cenaZaKus: Number(p.cena_za_kus) || 0,
        sleva: Number(p.sleva) || 0,
        poznamky: p.poznamky ?? null,
        nakupniCena: produkt?.nakladovaCena != null ? Number(produkt.nakladovaCena) : null,
      }
    }),
  })))
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
