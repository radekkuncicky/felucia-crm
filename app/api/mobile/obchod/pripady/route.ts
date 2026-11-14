import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { mobileDealScope, getMobileOrWebSession, requireObchodnikOrAdmin, klientAdresa, toAbsoluteUrl } from '@/lib/mobile-helpers'
import { originZ } from '@/lib/fotkyOp'
import { TITULNI_STITEK } from '@/lib/fotoStitky'
import { checkDealLimit } from '@/lib/checkPlanLimit'
import { createWithUniqueKod } from '@/lib/uniqueKod'
import { generateDealKod } from '@/lib/dealKod'
import { logAction } from '@/lib/auditLog'
import { Technologie, TypKlienta } from '@prisma/client'
import { quoteCelkemBezDph } from '@/lib/quoteMath'
import { najdiKlientIds, najdiIdsBezDiakritiky } from '@/lib/clientSearch'

const TECHNOLOGIE = Object.values(Technologie)

// GET /api/mobile/obchod/pripady — seznam OP pro pipeline/kanban.
// ?stav=NOVY,JEDNANI ?q=fulltext ?moje=1 (jen vlastní OP)
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const moje = searchParams.get('moje') === '1'
  const stavy = (searchParams.get('stav') ?? '').split(',').map(s => s.trim()).filter(Boolean)

  const klientIds = q ? ((await najdiKlientIds(db, orgId, q)) ?? []) : []
  const deals = await db.deal.findMany({
    where: {
      orgId,
      ...mobileDealScope(session!),
      ...(moje ? { userId } : {}),
      ...(stavy.length ? { stav: { in: stavy as never } } : { stav: { not: 'ZNEPLATNENO' } }),
      ...(q
        ? {
            OR: [
              { id: { in: (await najdiIdsBezDiakritiky(db, orgId, 'deal', q)) ?? [] } },
              { clientId: { in: klientIds } },
            ],
          }
        : {}),
    },
    include: {
      client: { select: { id: true, jmeno: true, prijmeni: true, telefon: true, ulice: true, mesto: true, psc: true } },
      user: { select: { id: true, jmeno: true } },
      quotes: { where: { aktivni: true }, select: { items: { select: { mnozstvi: true, cenaZaKus: true, sleva: true } } } },
      zamereni: { select: { id: true, stav: true } },
      // náhled do seznamu: „Dům zvenku“, jinak nejnovější fotka k OP
      photos: { select: { cesta: true, tag: true }, orderBy: { vytvoreno: 'desc' }, take: 10 },
    },
    orderBy: { vytvoreno: 'desc' },
    take: 200,
  })

  const origin = originZ(req)
  return NextResponse.json(
    deals.map(d => ({
      id: d.id,
      kod: d.kod,
      predmet: d.predmet,
      stav: d.stav,
      technologie: d.technologie,
      vytvoreno: d.vytvoreno,
      adresa: d.adresaDila || klientAdresa(d.client) || null,
      klient: {
        id: d.client.id,
        jmeno: `${d.client.jmeno} ${d.client.prijmeni}`.trim(),
        telefon: d.client.telefon,
      },
      obchodnik: d.user ? { id: d.user.id, jmeno: d.user.jmeno } : null,
      hodnota: d.quotes[0] ? Math.round(quoteCelkemBezDph(d.quotes[0].items)) : null,
      titulniFoto: (() => {
        const f = d.photos.find(p => p.tag === TITULNI_STITEK) ?? d.photos[0]
        return f ? toAbsoluteUrl(f.cesta, origin) : null
      })(),
      zamereni: {
        celkem: d.zamereni.length,
        uzavrena: d.zamereni.filter(z => z.stav === 'UZAVRENE').length,
      },
    })),
  )
}

// POST /api/mobile/obchod/pripady — nový případ; klient existující (clientId)
// nebo nový inline (klient: {...}, typicky předvyplněný z ARES)
export async function POST(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)

  let body: {
    clientId?: string
    klient?: {
      jmeno?: string
      prijmeni?: string
      typKlienta?: string
      telefon?: string
      email?: string
      ulice?: string
      mesto?: string
      psc?: string
      ico?: string
      dic?: string
    }
    technologie?: string
    predmet?: string
    adresaDila?: string
    poznamky?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Neplatný požadavek' }, { status: 400 })
  }

  if (!body.technologie || !TECHNOLOGIE.includes(body.technologie as Technologie)) {
    return NextResponse.json({ error: 'Neplatná technologie' }, { status: 400 })
  }
  if (!body.clientId && !body.klient?.jmeno?.trim()) {
    return NextResponse.json({ error: 'Chybí klient (clientId nebo klient.jmeno)' }, { status: 400 })
  }

  if (!(await checkDealLimit(orgId))) {
    return NextResponse.json({
      error: 'PLAN_LIMIT_REACHED',
      message: 'Dosáhli jste limitu obchodních případů pro váš plán.',
    }, { status: 403 })
  }

  let clientId = body.clientId ?? null
  if (!clientId) {
    const k = body.klient!
    const typKlienta = k.typKlienta === 'FIRMA' ? TypKlienta.FIRMA : TypKlienta.FYZICKA_OSOBA
    const client = await db.client.create({
      data: {
        orgId,
        typKlienta,
        jmeno: k.jmeno!.trim(),
        prijmeni: k.prijmeni?.trim() ?? '',
        telefon: k.telefon?.trim() || null,
        email: k.email?.trim() || null,
        ulice: k.ulice?.trim() || null,
        mesto: k.mesto?.trim() || null,
        psc: k.psc?.trim() || null,
        ico: k.ico?.trim() || null,
        dic: k.dic?.trim() || null,
      },
    })
    clientId = client.id
  } else {
    const existing = await db.client.findFirst({ where: { id: clientId } })
    if (!existing) return NextResponse.json({ error: 'Klient nenalezen' }, { status: 404 })
  }

  const deal = await createWithUniqueKod(
    () => generateDealKod(orgId),
    kod => db.deal.create({
      data: {
        orgId,
        clientId: clientId!,
        userId,
        kod,
        technologie: body.technologie as Technologie,
        stav: 'NOVY',
        predmet: body.predmet?.trim() || null,
        adresaDila: body.adresaDila?.trim() || null,
        poznamky: body.poznamky?.trim() || null,
      },
    }),
  )

  await logAction({
    orgId,
    userId,
    typAkce: 'CREATE',
    typZaznamu: 'Deal',
    zaznamId: deal.id,
    zaznamNazev: `${deal.kod ?? ''} ${deal.predmet ?? 'Nový případ'}`.trim(),
    zmeny: { kod: deal.kod, technologie: deal.technologie, zdroj: 'mobile-obchod' },
  })

  return NextResponse.json({ id: deal.id, kod: deal.kod, clientId }, { status: 201 })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
