// „Zapsat hovor" — rychlá evidence telefonátu jedním dialogem: najdi volajícího
// podle čísla (klient + jeho otevřené OP, lead) a zapiš hovor jako hotovou
// aktivitu k existujícímu OP, k leadu (nový/stávající) nebo k nově založenému OP.
// Navazující krok (zavolat znovu, schůzka…) vznikne jako naplánovaná aktivita.

import type { OrgPrismaClient } from './orgPrisma'
import { normalizePhone } from './clientDuplicate'

export interface HovorKlient {
  id: string
  nazev: string
  telefon: string | null
  otevreneOp: { id: string; kod: string | null; predmet: string | null; stav: string }[]
}

export interface HovorLead {
  id: string
  jmeno: string
  firma: string | null
  telefon: string | null
  status: string
}

export interface HovorShody {
  klienti: HovorKlient[]
  leady: HovorLead[]
}

/** Stavy OP, ke kterým se hovor ještě dá připsat (rozjednané) */
export const OTEVRENE_STAVY_OP = ['NOVY', 'JEDNANI', 'NABIDKA', 'PRED_UZAVRENIM'] as const

/** Číslo se hledá od 6 číslic (bez předvolby) — kratší by vracelo náhodné shody */
export const MIN_CISLIC = 6

export const klientNazev = (k: { jmeno: string; prijmeni: string | null; typKlienta: string | null }): string =>
  k.typKlienta === 'FIRMA' ? k.jmeno : `${k.jmeno} ${k.prijmeni ?? ''}`.trim()

/**
 * Klienti a otevřené leady se shodným telefonem (normalizovaně, bez +420).
 * `dealScope` = dealScopeWhere — OP mimo rozsah uživatele se nevrací.
 */
export async function najdiVolajiciho(
  db: OrgPrismaClient,
  orgId: string,
  telefon: string,
  dealScope: Record<string, unknown>,
): Promise<HovorShody> {
  const cislo = normalizePhone(telefon)
  if (cislo.length < MIN_CISLIC) return { klienti: [], leady: [] }
  const sedi = (t: string | null) => {
    const n = normalizePhone(t)
    return n.length >= MIN_CISLIC && (n === cislo || n.endsWith(cislo) || cislo.endsWith(n))
  }

  // Telefon bývá uložený s mezerami/předvolbou → porovnání normalizovaně v JS
  // (stejně jako duplicity klientů, lib/clientDuplicate)
  const [klienti, leady] = await Promise.all([
    db.client.findMany({
      where: { orgId, telefon: { not: null }, anonymizedAt: null },
      select: { id: true, jmeno: true, prijmeni: true, typKlienta: true, telefon: true },
    }),
    db.lead.findMany({
      where: { orgId, telefon: { not: null }, status: { notIn: ['PREVEDEN', 'ZRUSEN'] } },
      select: { id: true, jmeno: true, firma: true, telefon: true, status: true },
      orderBy: { vytvoreno: 'desc' },
    }),
  ])

  const shodniKlienti = klienti.filter(k => sedi(k.telefon)).slice(0, 5)
  const op = shodniKlienti.length === 0 ? [] : await db.deal.findMany({
    where: { orgId, ...dealScope, clientId: { in: shodniKlienti.map(k => k.id) }, stav: { in: [...OTEVRENE_STAVY_OP] } },
    select: { id: true, kod: true, predmet: true, stav: true, clientId: true },
    orderBy: { vytvoreno: 'desc' },
  })

  return {
    klienti: shodniKlienti.map(k => ({
      id: k.id,
      nazev: klientNazev(k),
      telefon: k.telefon,
      otevreneOp: op.filter(d => d.clientId === k.id).map(d => ({ id: d.id, kod: d.kod, predmet: d.predmet, stav: d.stav })),
    })),
    leady: leady.filter(l => sedi(l.telefon)).slice(0, 5),
  }
}

