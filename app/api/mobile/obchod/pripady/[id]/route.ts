import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin, klientAdresa } from '@/lib/mobile-helpers'
import { quoteCelkemBezDph } from '@/lib/quoteMath'
import { logAction } from '@/lib/auditLog'

// GET /api/mobile/obchod/pripady/[id] — detail případu pro appku
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const db = orgPrisma(session!.user.orgId)
  const deal = await db.deal.findFirst({
    where: { id: params.id },
    include: {
      client: true,
      user: { select: { id: true, jmeno: true } },
      quotes: {
        include: { items: { select: { mnozstvi: true, cenaZaKus: true, sleva: true } } },
        orderBy: { vytvoreno: 'asc' },
      },
      zamereni: {
        include: { fotky: { select: { id: true } } },
        orderBy: { vytvoreno: 'desc' },
      },
      activities: {
        include: { user: { select: { id: true, jmeno: true } } },
        orderBy: { datum: 'desc' },
        take: 30,
      },
      sod: {
        select: { id: true, cislo: true, stav: true, vytvoreno: true },
        orderBy: { vytvoreno: 'desc' },
      },
      zakazky: { select: { id: true, cislo: true, stav: true } },
    },
  })
  if (!deal) return NextResponse.json({ error: 'Případ nenalezen' }, { status: 404 })

  return NextResponse.json({
    id: deal.id,
    kod: deal.kod,
    predmet: deal.predmet,
    stav: deal.stav,
    technologie: deal.technologie,
    poznamky: deal.poznamky,
    duvodProhry: deal.duvodProhry,
    duvodProhryKod: deal.duvodProhryKod,
    adresaDila: deal.adresaDila,
    adresa: deal.adresaDila || klientAdresa(deal.client) || null,
    kontaktniOsoba: deal.kontaktniOsoba,
    kontaktniTelefon: deal.kontaktniTelefon,
    terminRealizace: deal.terminRealizace,
    vytvoreno: deal.vytvoreno,
    obchodnik: deal.user ? { id: deal.user.id, jmeno: deal.user.jmeno } : null,
    klient: {
      id: deal.client.id,
      typKlienta: deal.client.typKlienta,
      jmeno: deal.client.jmeno,
      prijmeni: deal.client.prijmeni,
      telefon: deal.client.telefon,
      email: deal.client.email,
      adresa: klientAdresa(deal.client) || null,
      ulice: deal.client.ulice,
      mesto: deal.client.mesto,
      psc: deal.client.psc,
      ico: deal.client.ico,
      dic: deal.client.dic,
    },
    nabidky: deal.quotes.map(q => ({
      id: q.id,
      kod: q.kod,
      nazev: q.nazev,
      aktivni: q.aktivni,
      dphSazba: q.dphSazba,
      platnostDo: q.platnostDo,
      odeslanoAt: q.odeslanoAt,
      odeslanoKanal: q.odeslanoKanal,
      celkemBezDph: Math.round(quoteCelkemBezDph(q.items) * 100) / 100,
      pocetPolozek: q.items.length,
    })),
    zamereni: deal.zamereni.map(z => ({
      id: z.id,
      typ: z.typ,
      stav: z.stav,
      datum: z.datum,
      pocetFotek: z.fotky.length,
    })),
    aktivity: deal.activities.map(a => ({
      id: a.id,
      typ: a.typ,
      popis: a.popis,
      datum: a.datum,
      cas: a.cas,
      splneno: a.splneno,
      stav: a.stav,
      autor: a.user ? { id: a.user.id, jmeno: a.user.jmeno } : null,
    })),
    smlouvy: deal.sod.map(s => ({ id: s.id, cislo: s.cislo, stav: s.stav, vytvoreno: s.vytvoreno })),
    zakazky: deal.zakazky,
  })
}

const PATCH_POLA = [
  'predmet', 'poznamky', 'adresaDila', 'kontaktniOsoba', 'kontaktniTelefon',
] as const

// PATCH /api/mobile/obchod/pripady/[id] — úprava textových polí + termín realizace
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const db = orgPrisma(session!.user.orgId)
  const deal = await db.deal.findFirst({ where: { id: params.id } })
  if (!deal) return NextResponse.json({ error: 'Případ nenalezen' }, { status: 404 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Neplatný požadavek' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  for (const pole of PATCH_POLA) {
    if (typeof body[pole] === 'string') data[pole] = (body[pole] as string).trim() || null
    else if (body[pole] === null) data[pole] = null
  }
  if (body.terminRealizace !== undefined) {
    data.terminRealizace = body.terminRealizace ? new Date(String(body.terminRealizace)) : null
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Žádná pole ke změně' }, { status: 400 })
  }

  const updated = await db.deal.update({ where: { id: params.id }, data })

  await logAction({
    orgId: session!.user.orgId,
    userId: session!.user.id,
    typAkce: 'UPDATE',
    typZaznamu: 'Deal',
    zaznamId: deal.id,
    zaznamNazev: `${deal.kod ?? ''} ${deal.predmet ?? ''}`.trim(),
    zmeny: data,
  })

  return NextResponse.json({ id: updated.id, ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
