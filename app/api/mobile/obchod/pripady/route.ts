import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { mobileDealScope, getMobileOrWebSession, requireObchodnikOrAdmin, klientAdresa, toAbsoluteUrl } from '@/lib/mobile-helpers'
import { originZ } from '@/lib/fotkyOp'
import { TITULNI_STITEK } from '@/lib/fotoStitky'
import { parseMobileId, idempotentne, MobileIdKolize } from '@/lib/mobileIdempotence'
import { najdiDuplicitnihoKlienta } from '@/lib/clientDuplicate'
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
    gpsLat?: number
    gpsLng?: number
    /** idempotence offline fronty — opakované odeslání vrátí už založený OP */
    mobileId?: string
    /** založeno bez signálu: ARES ani duplicity se v appce neověřily → ověří server */
    offline?: boolean
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

  const mobileId = parseMobileId(body.mobileId)
  if (mobileId) {
    const uz = await db.deal.findFirst({ where: { mobileId }, select: { id: true, kod: true, clientId: true } })
    if (uz) return NextResponse.json({ id: uz.id, kod: uz.kod, clientId: uz.clientId, pripojenoKlient: null }, { status: 200 })
  }

  if (!(await checkDealLimit(orgId))) {
    return NextResponse.json({
      error: 'PLAN_LIMIT_REACHED',
      message: 'Dosáhli jste limitu obchodních případů pro váš plán.',
    }, { status: 403 })
  }

  let clientId = body.clientId ?? null
  let pripojenoKlient: { id: string; jmeno: string } | null = null

  // opakování po pádu mezi založením klienta a OP — klient už existuje
  if (!clientId && mobileId) {
    const k = await db.client.findFirst({ where: { mobileId }, select: { id: true } })
    if (k) clientId = k.id
  }

  // offline založení: duplicity se v appce nekontrolovaly → shoda IČO / telefon / e-mail
  // připojí OP k existujícímu klientovi (jméno samo nestačí — dva různí lidé)
  if (!clientId && body.offline) {
    const k = body.klient!
    const ico = k.ico?.trim()
    const podleIco = ico ? await db.client.findFirst({ where: { ico, anonymizedAt: null }, select: { id: true, jmeno: true, prijmeni: true } }) : null
    let shoda = podleIco
    if (!shoda && (k.telefon?.trim() || k.email?.trim())) {
      const kandidati = await db.client.findMany({
        where: { anonymizedAt: null },
        select: { id: true, jmeno: true, prijmeni: true, telefon: true, email: true },
      })
      shoda = najdiDuplicitnihoKlienta(kandidati, { telefon: k.telefon ?? null, email: k.email ?? null })
    }
    if (shoda) {
      clientId = shoda.id
      pripojenoKlient = { id: shoda.id, jmeno: `${shoda.jmeno} ${shoda.prijmeni}`.trim() }
    }
  }

  if (!clientId) {
    const k = body.klient!
    const typKlienta = k.typKlienta === 'FIRMA' ? TypKlienta.FIRMA : TypKlienta.FYZICKA_OSOBA
    // souběh dvou stejných požadavků z fronty — klient podle mobileId jen jednou
    const { zaznam: client } = await idempotentne(
      mobileId,
      m => db.client.findFirst({ where: { mobileId: m } }),
      () => db.client.create({
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
        mobileId,
      },
    }),
    )
    clientId = client.id
  } else if (body.clientId) {
    const existing = await db.client.findFirst({ where: { id: clientId } })
    if (!existing) return NextResponse.json({ error: 'Klient nenalezen' }, { status: 404 })
  }

  const gps = Number.isFinite(body.gpsLat) && Number.isFinite(body.gpsLng)
    && Math.abs(body.gpsLat!) <= 90 && Math.abs(body.gpsLng!) <= 180
    ? { gpsLat: body.gpsLat!, gpsLng: body.gpsLng! }
    : {}

  let deal
  try {
    const r = await idempotentne(
      mobileId,
      m => db.deal.findFirst({ where: { mobileId: m } }),
      () => createWithUniqueKod(
    () => generateDealKod(orgId),
    kod => db.deal.create({
      data: {
        mobileId,
        ...gps,
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
      ),
    )
    deal = r.zaznam
    if (!r.novy) return NextResponse.json({ id: deal.id, kod: deal.kod, clientId: deal.clientId, pripojenoKlient: null }, { status: 200 })
  } catch (e) {
    if (e instanceof MobileIdKolize) return NextResponse.json({ error: 'Neplatné mobileId' }, { status: 422 })
    throw e
  }

  await logAction({
    orgId,
    userId,
    typAkce: 'CREATE',
    typZaznamu: 'Deal',
    zaznamId: deal.id,
    zaznamNazev: `${deal.kod ?? ''} ${deal.predmet ?? 'Nový případ'}`.trim(),
    zmeny: { kod: deal.kod, technologie: deal.technologie, zdroj: body.offline ? 'mobile-obchod-offline' : 'mobile-obchod' },
  })

  return NextResponse.json({ id: deal.id, kod: deal.kod, clientId, pripojenoKlient }, { status: 201 })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
