import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { leadJmeno } from '@/lib/activities'
import { getMobileOrWebSession, requireObchodnikOrAdmin, mobileDealScope, klientAdresa } from '@/lib/mobile-helpers'
import { posunDen } from '@/lib/datumPraha'
import {
  AKTIVITA_DOPLNEK, DOPLNEK, calendarTitle, klientJmeno, technologieLabel, utcDateStr,
} from '@/lib/calendarEvents'

const YMD = /^\d{4}-\d{2}-\d{2}$/
const MAX_DNU = 62

export type KalendarUdalost = {
  id: string
  druh: 'AKTIVITA' | 'REALIZACE' | 'PREVZETI' | 'ZALOHA'
  /** typ aktivity (HOVOR/EMAIL/SCHUZKA/UKOL/POZNAMKA), u termínů OP null */
  typ: string | null
  datum: string
  datumDo: string | null
  cas: string | null
  trvaniMin: number | null
  nazev: string
  popis: string | null
  misto: string | null
  stav: string | null
  splneno: boolean
  dealId: string | null
  leadId: string | null
  telefon: string | null
}

// GET /api/mobile/obchod/kalendar?od=YYYY-MM-DD&do=YYYY-MM-DD — pohled Týden v Sales.
// `do` včetně, max 62 dní. Moje aktivity (u OP i leadů) + termíny OP v mém rozsahu
// (realizace, předání díla, záloha). Stejné názvy jako web a ICS feed.
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const sp = new URL(req.url).searchParams
  const od = sp.get('od') ?? ''
  const doIncl = sp.get('do') ?? ''
  if (!YMD.test(od) || !YMD.test(doIncl) || doIncl < od) {
    return NextResponse.json({ error: 'Neplatný rozsah (od, do ve tvaru YYYY-MM-DD)' }, { status: 400 })
  }
  const odD = new Date(`${od}T00:00:00.000Z`)
  const doD = new Date(`${posunDen(doIncl, 1)}T00:00:00.000Z`)
  if (Number.isNaN(odD.getTime()) || Number.isNaN(doD.getTime()) || (doD.getTime() - odD.getTime()) / 86_400_000 > MAX_DNU) {
    return NextResponse.json({ error: `Rozsah nejvýš ${MAX_DNU} dní` }, { status: 400 })
  }

  const { orgId, id: userId, plan } = session!.user
  const db = orgPrisma(orgId)
  const dealScope = mobileDealScope(session!)
  const rozsah = { gte: odD, lt: doD }

  const [aktivity, dealy] = await Promise.all([
    db.activity.findMany({
      where: {
        orgId,
        datum: rozsah,
        AND: [
          { OR: [{ userId }, { resitelId: userId }] },
          // jen aktivity u OP nebo leadu (leady od STANDARD), ne volné diktáty
          plan === 'STARTER' ? { dealId: { not: null } } : { OR: [{ dealId: { not: null } }, { leadId: { not: null } }] },
        ],
      },
      include: {
        deal: {
          select: {
            id: true, predmet: true, kod: true, technologie: true, adresaDila: true,
            client: { select: { jmeno: true, prijmeni: true, typKlienta: true, telefon: true, ulice: true, mesto: true, psc: true } },
          },
        },
        lead: { select: { id: true, jmeno: true, firma: true, telefon: true } },
      },
      orderBy: [{ datum: 'asc' }, { cas: 'asc' }],
      take: 500,
    }),
    db.deal.findMany({
      where: {
        orgId,
        ...dealScope,
        OR: [
          { terminRealizace: rozsah },
          { terminPrevzeti: rozsah },
          { splatnostZalohy: rozsah },
          // realizace začatá dřív, převzetí až v rozsahu nebo později (vícedenní)
          { terminRealizace: { lt: odD }, terminPrevzeti: { gte: odD } },
        ],
      },
      select: {
        id: true, predmet: true, kod: true, technologie: true, adresaDila: true,
        terminRealizace: true, terminPrevzeti: true, splatnostZalohy: true,
        client: { select: { jmeno: true, prijmeni: true, typKlienta: true, telefon: true, ulice: true, mesto: true, psc: true } },
      },
      take: 300,
    }),
  ])

  const udalosti: KalendarUdalost[] = []

  for (const a of aktivity) {
    const klient = a.deal ? klientJmeno(a.deal.client) : a.lead ? leadJmeno(a.lead) : ''
    const tech = a.deal ? technologieLabel(a.deal.technologie) : 'Lead'
    const misto = a.misto ?? (a.typ === 'SCHUZKA' && a.deal ? (a.deal.adresaDila || klientAdresa(a.deal.client) || null) : null)
    udalosti.push({
      id: a.id,
      druh: 'AKTIVITA',
      typ: a.typ,
      datum: utcDateStr(a.datum),
      datumDo: null,
      cas: a.cas,
      trvaniMin: a.cas ? (a.trvaniMin ?? (a.typ === 'SCHUZKA' ? 60 : 15)) : null,
      nazev: calendarTitle(klient, tech, AKTIVITA_DOPLNEK[a.typ] ?? a.typ.toLowerCase()),
      popis: a.popis ?? a.cil ?? null,
      misto,
      stav: a.stav,
      splneno: a.splneno,
      dealId: a.dealId,
      leadId: a.leadId,
      telefon: a.deal?.client.telefon ?? a.lead?.telefon ?? null,
    })
  }

  const vRozsahu = (d: Date | null) => !!d && d >= odD && d < doD
  for (const d of dealy) {
    const klient = klientJmeno(d.client)
    const tech = technologieLabel(d.technologie)
    const zaklad = {
      typ: null, cas: null, trvaniMin: null, popis: d.predmet ?? d.kod ?? null,
      misto: d.adresaDila || klientAdresa(d.client) || null, stav: null, splneno: false,
      dealId: d.id, leadId: null, telefon: d.client.telefon ?? null,
    }
    if (d.terminRealizace) {
      const konec = d.terminPrevzeti && d.terminPrevzeti > d.terminRealizace ? d.terminPrevzeti : null
      const zacatek = utcDateStr(d.terminRealizace)
      const datumDo = konec ? utcDateStr(konec) : null
      if (vRozsahu(d.terminRealizace) || (konec && d.terminRealizace < odD && konec >= odD)) {
        udalosti.push({ ...zaklad, id: `rea-${d.id}`, druh: 'REALIZACE', datum: zacatek, datumDo, nazev: calendarTitle(klient, tech, DOPLNEK.REALIZACE) })
      }
    }
    if (vRozsahu(d.terminPrevzeti)) {
      udalosti.push({ ...zaklad, id: `pre-${d.id}`, druh: 'PREVZETI', datum: utcDateStr(d.terminPrevzeti!), datumDo: null, nazev: calendarTitle(klient, tech, DOPLNEK.PREVZETI) })
    }
    if (vRozsahu(d.splatnostZalohy)) {
      udalosti.push({ ...zaklad, id: `zal-${d.id}`, druh: 'ZALOHA', datum: utcDateStr(d.splatnostZalohy!), datumDo: null, nazev: calendarTitle(klient, tech, DOPLNEK.ZALOHA) })
    }
  }

  // den → celodenní/termíny nahoře, pak podle času
  udalosti.sort((x, y) => x.datum.localeCompare(y.datum) || (x.cas ?? '').localeCompare(y.cas ?? ''))
  return NextResponse.json({ od, do: doIncl, udalosti })
}
