import { NextResponse } from 'next/server'
import { hasDeal } from '@/lib/activities'
import { orgPrisma } from '@/lib/orgPrisma'
import { dnesPrahaRozsah } from '@/lib/datumPraha'
import { getMobileOrWebSession, requireObchodnikOrAdmin, klientAdresa } from '@/lib/mobile-helpers'

// GET /api/mobile/obchod/dnes — plán dne obchodníka:
// dnešní schůzky/hovory + nesplněné follow-upy (i prošlé) s adresou pro navigaci
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)

  // pražský den, ne UTC (server běží v UTC — po půlnoci by ukazoval včerejšek)
  const { od: todayStart, do: zitraStart } = dnesPrahaRozsah()

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

  const [dnesni, followUpy, leadAktivity] = await Promise.all([
    // Dnešní plánované aktivity (schůzky, hovory, úkoly…)
    db.activity.findMany({
      where: {
        deal: { orgId },
        ...mojeAktivity,
        datum: { gte: todayStart, lt: zitraStart },
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
    // Naplánované hovory/e-maily u otevřených leadů do konce dneška (i prošlé)
    db.activity.findMany({
      where: {
        lead: { orgId, status: { notIn: ['PREVEDEN', 'ZRUSEN'] } },
        ...mojeAktivity,
        datum: { lt: zitraStart },
        stav: 'PLANOVANA',
      },
      include: { lead: { select: { id: true, jmeno: true, firma: true, telefon: true, status: true } } },
      orderBy: [{ datum: 'asc' }, { cas: 'asc' }],
      take: 50,
    }),
  ])

  const mapAktivita = (a: (typeof dnesni)[number] & { deal: NonNullable<(typeof dnesni)[number]['deal']> }) => ({
    id: a.id,
    typ: a.typ,
    popis: a.popis,
    cil: a.cil,
    datum: a.datum,
    cas: a.cas,
    trvaniMin: a.trvaniMin,
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
    // s časem podle času, bez času na konec (celodenní úkoly)
    dnesni: dnesni.filter(hasDeal).map(mapAktivita)
      .sort((a, b) => (a.cas ? 0 : 1) - (b.cas ? 0 : 1) || (a.cas ?? '').localeCompare(b.cas ?? '')),
    followUpy: followUpy.filter(hasDeal).map(mapAktivita),
    // samostatný klíč — starší verze appky (bez leadů) ho ignorují
    leadAktivity: leadAktivity.flatMap(a => a.lead ? [{
      id: a.id,
      typ: a.typ,
      popis: a.popis,
      datum: a.datum,
      cas: a.cas,
      prosla: a.datum < todayStart,
      lead: { id: a.lead.id, jmeno: a.lead.jmeno, firma: a.lead.firma, telefon: a.lead.telefon, status: a.lead.status },
    }] : []),
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
