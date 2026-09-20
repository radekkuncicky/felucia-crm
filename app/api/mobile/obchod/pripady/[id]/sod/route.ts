import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { mobileDealScope, getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { createSodFromDeal } from '@/lib/sodCreate'
import { quoteCelkemBezDph, quoteCelkemSDph } from '@/lib/quoteMath'
import { logAction } from '@/lib/auditLog'

// POST /api/mobile/obchod/pripady/[id]/sod — SOD z odsouhlasené varianty nabídky.
// { quoteId, templateId, terminPrevzeti?, poznamky? } — quoteId se nejdřív
// aktivuje (ceny do smlouvy jdou z aktivní nabídky), pak vznikne SOD přes
// stejné jádro jako na webu. Podpis na místě řeší stávající SOD systém (Fáze 6).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)

  const deal = await db.deal.findFirst({ where: { id: params.id, ...mobileDealScope(session!) }, select: { id: true, kod: true } })
  if (!deal) return NextResponse.json({ error: 'Případ nenalezen' }, { status: 404 })

  let body: {
    quoteId?: string
    templateId?: string
    typ?: string
    terminPrevzeti?: string
    poznamky?: string
    overrides?: Record<string, string>
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Neplatný požadavek' }, { status: 400 })
  }

  if (!body.quoteId) return NextResponse.json({ error: 'quoteId je povinný' }, { status: 400 })
  if (!body.templateId && !body.typ) {
    return NextResponse.json({ error: 'templateId nebo typ je povinný' }, { status: 400 })
  }

  const quote = await db.quote.findFirst({
    where: { id: body.quoteId, dealId: deal.id },
    include: { items: { select: { mnozstvi: true, cenaZaKus: true, sleva: true } } },
  })
  if (!quote) return NextResponse.json({ error: 'Nabídka nenalezena na tomto případu' }, { status: 404 })

  // Odsouhlasená varianta = aktivní nabídka (z ní se berou ceny do smlouvy)
  if (!quote.aktivni) {
    await db.quote.updateMany({ where: { dealId: deal.id, id: { not: quote.id } }, data: { aktivni: false } })
    await db.quote.update({ where: { id: quote.id }, data: { aktivni: true } })
  }

  const cenaBezDph = Math.round(quoteCelkemBezDph(quote.items) * 100) / 100
  const cenaSDph = Math.round(quoteCelkemSDph(quote.items, quote.dphSazba) * 100) / 100

  const result = await createSodFromDeal(db, orgId, {
    dealId: deal.id,
    templateId: body.templateId ?? null,
    typ: body.typ ?? null,
    overrides: body.overrides ?? {},
    form: {
      cenaBezDph,
      cenaSDph,
      dphSazba: quote.dphSazba,
      terminPrevzeti: body.terminPrevzeti ?? null,
      poznamky: body.poznamky ?? null,
    },
  })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 404 })

  await logAction({
    orgId,
    userId,
    typAkce: 'CREATE',
    typZaznamu: 'Sod',
    zaznamId: result.sod.id,
    zaznamNazev: `${result.sod.cislo} (${deal.kod ?? ''})`.trim(),
    zmeny: { quoteId: quote.id, zdroj: 'mobile-obchod' },
  })

  return NextResponse.json({
    id: result.sod.id,
    cislo: result.sod.cislo,
    stav: result.sod.stav,
    cenaBezDph,
    cenaSDph,
  }, { status: 201 })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
