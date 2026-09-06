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
  | { ok: true; etapa: EtapaSDetailem; zakazkaNovyStav: 'V_REALIZACI' | null }
  | { ok: false; status: number; error: string }

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
    const cislo = (last?.cislo ?? 0) + 1

    try {
      let zakazkaNovyStav: 'V_REALIZACI' | null = null
      const etapa = await db.$transaction(async tx => {
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

      return { ok: true, etapa, zakazkaNovyStav }
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
