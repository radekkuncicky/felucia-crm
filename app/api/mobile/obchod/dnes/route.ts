import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin, klientAdresa } from '@/lib/mobile-helpers'

// GET /api/mobile/obchod/dnes — plán dne obchodníka:
// dnešní schůzky/hovory + nesplněné follow-upy (i prošlé) s adresou pro navigaci
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  const dealInclude = {
    deal: {
      select: {
        id: true,
        kod: true,
        predmet: true,
        stav: true,
        adresaDila: true,
        client: { select: { jmeno: true, prijmeni: true, telefon: true, ulice: true, mesto: true, psc: true } },
      },
    },
  }

  const mojeAktivity = { OR: [{ userId }, { resitelId: userId }] }

  const [dnesni, followUpy] = await Promise.all([
    // Dnešní plánované aktivity (schůzky, hovory, úkoly…)
    db.activity.findMany({
      where: {
        deal: { orgId },
        ...mojeAktivity,
        datum: { gte: todayStart, lte: todayEnd },
        stav: 'PLANOVANA',
      },
      include: dealInclude,
      orderBy: [{ datum: 'asc' }, { cas: 'asc' }],
    }),
    // Nesplněné follow-upy z minulosti (resty)
    db.activity.findMany({
      where: {
        deal: { orgId },
        ...mojeAktivity,
        datum: { lt: todayStart },
        stav: 'PLANOVANA',
        splneno: false,
      },
      include: dealInclude,
      orderBy: { datum: 'asc' },
      take: 50,
    }),
  ])

  const mapAktivita = (a: (typeof dnesni)[number]) => ({
    id: a.id,
    typ: a.typ,
    popis: a.popis,
    cil: a.cil,
    datum: a.datum,
    cas: a.cas,
    misto: a.misto,
    pripad: {
      id: a.deal.id,
      kod: a.deal.kod,
      predmet: a.deal.predmet,
      stav: a.deal.stav,
      adresa: a.deal.adresaDila || klientAdresa(a.deal.client) || null,
      klient: {
        jmeno: `${a.deal.client.jmeno} ${a.deal.client.prijmeni}`.trim(),
        telefon: a.deal.client.telefon,
      },
    },
  })

  return NextResponse.json({
    dnesni: dnesni.map(mapAktivita),
    followUpy: followUpy.map(mapAktivita),
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
