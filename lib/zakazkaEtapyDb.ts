// DB logika založení další etapy zakázky — sdíleno mezi POST /api/zakazky/[id]/etapy
// (ruční přidání v sekci Etapy) a POST /api/vyuctovani/[id]/schvalit (volba
// „Schválit a zahájit další etapu"). Čistá odvozovací logika je v lib/zakazkaEtapy.ts,
// tohle je její DB obálka (gating, retry na souběh, návrat stavu zakázky).

import { Prisma } from '@prisma/client'
import type { OrgPrismaClient } from './orgPrisma'
import { etapaProgressFromRaw, lzePridatDalsiEtapu } from './zakazkaEtapy'

const MAX_ATTEMPTS = 5

const ETAPA_INCLUDE = {
  predavaky: { select: { id: true, cislo: true, stav: true } },
  vyuctovani: { select: { id: true, cislo: true, stav: true } },
} satisfies Prisma.ZakazkaEtapaInclude

export type EtapaSDetailem = Prisma.ZakazkaEtapaGetPayload<{ include: typeof ETAPA_INCLUDE }>

export interface ZalozEtapuData {
  nazev?: string | null
  montazOd?: Date | null
  montazDo?: Date | null
  poznamka?: string | null
}

export type ZalozEtapuResult =
  | {
      ok: true
      etapa: EtapaSDetailem
      zakazkaNovyStav: 'V_REALIZACI' | null
      /** Stávající práce (předávky/vyúčtování bez etapy) byla zařazena jako Etapa 1. */
      adoptovano: boolean
      /** Info pro uživatele, když se místo požadované etapy založila jen Etapa 1 ze stávající práce. */
      upozorneni: string | null
    }
  | { ok: false; status: number; error: string }

/**
 * Zakázka bez etap, na které už existují předávky/vyúčtování (jednofázová montáž):
 * tahle práce JE Etapa 1. Založí ji a přiřadí jí všechny doklady bez etapy.
 * Volat uvnitř transakce; P2002 na (zakazkaId, cislo) řeší retry volajícího.
 */
type OrgTx = Parameters<Parameters<OrgPrismaClient['$transaction']>[0]>[0]

async function adoptujStavajiciPraci(
  tx: OrgTx,
  orgId: string,
  zakazka: { id: string; montazOd: Date | null; montazDo: Date | null },
) {
  const schvalenyPredavak = await tx.predavak.count({
    where: { zakazkaId: zakazka.id, etapaId: null, stav: 'SCHVALEN' },
  })
  const e1 = await tx.zakazkaEtapa.create({
    data: {
      orgId,
      zakazkaId: zakazka.id,
      cislo: 1,
      montazOd: zakazka.montazOd,
      montazDo: zakazka.montazDo,
      stav: schvalenyPredavak > 0 ? 'PREDANA' : 'PROBIHAJICI',
    },
  })
  await tx.predavak.updateMany({ where: { zakazkaId: zakazka.id, etapaId: null }, data: { etapaId: e1.id } })
  await tx.vyuctovani.updateMany({ where: { zakazkaId: zakazka.id, etapaId: null }, data: { etapaId: e1.id } })
  return tx.zakazkaEtapa.findUniqueOrThrow({ where: { id: e1.id }, include: ETAPA_INCLUDE })
}

/**
 * Založí další etapu zakázky (lineární gating — poslední etapa musí být kompletně
 * vyúčtovaná) a vrátí zakázku ze stavu PREDANA/VYUCTOVANA zpět do V_REALIZACI,
 * aby nová etapa začala stejně jako ty předchozí. Retry na (zakazkaId, cislo)
 * kolizi — dvojklik nebo souběh dvou requestů by jinak spadl jako neošetřená výjimka;
 * číslo i gating se přepočítá znovu při každém pokusu, ne jen jednou dopředu.
 */
export async function zalozDalsiEtapu(
  db: OrgPrismaClient,
  orgId: string,
  zakazkaId: string,
  data: ZalozEtapuData = {},
): Promise<ZalozEtapuResult> {
  const zakazka = await db.zakazka.findFirst({ where: { id: zakazkaId, orgId } })
  if (!zakazka) return { ok: false, status: 404, error: 'Zakázka nenalezena' }

  let lastError: unknown = null
  for (let pokus = 0; pokus < MAX_ATTEMPTS; pokus++) {
    const last = await db.zakazkaEtapa.findFirst({
      where: { zakazkaId },
      orderBy: { cislo: 'desc' },
      include: {
        predavaky: { select: { stav: true } },
        vyuctovani: { select: { stav: true } },
      },
    })
    if (last && !lzePridatDalsiEtapu([etapaProgressFromRaw(last)])) {
      return {
        ok: false,
        status: 422,
        error: `Etapu ${last.cislo} je nejdřív potřeba dokončit (montáž → předávka → vyúčtování), než půjde přidat další.`,
      }
    }
    // První etapa na zakázce, která už má doklady → stávající práce se stane Etapou 1
    const adoptovat = !last && (
      await db.predavak.count({ where: { zakazkaId, etapaId: null } }) +
      await db.vyuctovani.count({ where: { zakazkaId, etapaId: null } })
    ) > 0

    try {
      let zakazkaNovyStav: 'V_REALIZACI' | null = null
      let upozorneni: string | null = null
      const etapa = await db.$transaction(async tx => {
        let cislo = (last?.cislo ?? 0) + 1
        if (adoptovat) {
          const e1 = await adoptujStavajiciPraci(tx, orgId, zakazka)
          if (!lzePridatDalsiEtapu([etapaProgressFromRaw(e1)])) {
            upozorneni = 'Stávající práce byla zařazena jako Etapa 1. Další etapu přidáte, až bude Etapa 1 předaná a vyúčtovaná.'
            return e1
          }
          cislo = 2
        }

        const e = await tx.zakazkaEtapa.create({
          data: {
            orgId,
            zakazkaId,
            cislo,
            nazev: data.nazev ?? null,
            montazOd: data.montazOd ?? null,
            montazDo: data.montazDo ?? null,
            poznamka: data.poznamka ?? null,
            stav: 'PLANOVANA',
          },
          include: ETAPA_INCLUDE,
        })

        // Zakázka „hotová" po předchozí etapě se novou etapou vrací do realizace
        if (zakazka.stav === 'PREDANA' || zakazka.stav === 'VYUCTOVANA') {
          await tx.zakazka.update({
            where: { id: zakazkaId },
            data: { stav: 'V_REALIZACI' },
          })
          zakazkaNovyStav = 'V_REALIZACI'
        }

        return e
      })

      return { ok: true, etapa, zakazkaNovyStav, adoptovano: adoptovat, upozorneni }
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        lastError = e
        continue
      }
      console.error(`[zakazky/etapy] selhalo založení etapy pro zakázku ${zakazkaId}:`, e)
      return { ok: false, status: 500, error: 'Založení etapy se nezdařilo, zkuste to prosím znovu.' }
    }
  }

  console.error(`[zakazky/etapy] selhalo založení etapy pro zakázku ${zakazkaId} po ${MAX_ATTEMPTS} pokusech:`, lastError)
  return { ok: false, status: 500, error: 'Založení etapy se nezdařilo kvůli souběhu, zkuste to prosím znovu.' }
}
