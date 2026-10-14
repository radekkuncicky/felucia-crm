import { ZakazkaStav } from '@prisma/client'
import type { OrgPrismaClient } from './orgPrisma'
import { etapaKompletni, etapaProgressFromRaw } from './zakazkaEtapy'

/**
 * Automatické posuny stavu zakázky navázané na předávky a vyúčtování.
 *
 * Dopředu je posouvá podpis protokolu (→PREDANA) a schválení vyúčtování (→VYUCTOVANA).
 * Zpět je vrací tyhle helpery, když poslední doklad, který posun způsobil, zmizí
 * (odmítnutí/vrácení protokolu, vrácení schváleného vyúčtování k úpravám).
 * Ruční posun stavu přes /api/zakazky/[id]/stav nechávají být — vracejí jen z toho
 * stavu, který automatika sama nastavila, a jen když už ho nic nedrží.
 */

// Klient uvnitř db.$transaction(async tx => …) nad orgPrisma — rozšířený klient bez řídicích metod
type TxClient = Omit<OrgPrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

/**
 * Vrátí PREDANA → V_REALIZACI, pokud na zakázce nezbyl žádný odeslaný ani schválený protokol.
 * `ignorovatPredavakId` = protokol, který se právě odmítá/vrací (v DB ještě může mít starý stav).
 */
export async function vratZakazkuZPredane(
  tx: TxClient,
  zakazkaId: string,
  ignorovatPredavakId?: string,
): Promise<ZakazkaStav | null> {
  const zakazka = await tx.zakazka.findUnique({
    where: { id: zakazkaId },
    select: { stav: true },
  })
  if (!zakazka || zakazka.stav !== 'PREDANA') return null

  const jiny = await tx.predavak.findFirst({
    where: {
      zakazkaId,
      stav: { in: ['PODPISAN', 'SCHVALEN'] },
      ...(ignorovatPredavakId ? { id: { not: ignorovatPredavakId } } : {}),
    },
    select: { id: true },
  })
  if (jiny) return null

  await tx.zakazka.update({ where: { id: zakazkaId }, data: { stav: 'V_REALIZACI' } })
  return 'V_REALIZACI'
}

/**
 * Vrátí VYUCTOVANA → PREDANA, pokud na zakázce nezbylo žádné schválené vyúčtování.
 * `ignorovatVyuctovaniId` = vyúčtování, které se právě vrací k úpravám.
 */
export async function vratZakazkuZVyuctovane(
  tx: TxClient,
  zakazkaId: string,
  ignorovatVyuctovaniId?: string,
): Promise<ZakazkaStav | null> {
  const zakazka = await tx.zakazka.findUnique({
    where: { id: zakazkaId },
    select: { stav: true },
  })
  if (!zakazka || zakazka.stav !== 'VYUCTOVANA') return null

  const jine = await tx.vyuctovani.findFirst({
    where: {
      zakazkaId,
      stav: 'SCHVALENO',
      ...(ignorovatVyuctovaniId ? { id: { not: ignorovatVyuctovaniId } } : {}),
    },
    select: { id: true },
  })
  if (jine) return null

  await tx.zakazka.update({ where: { id: zakazkaId }, data: { stav: 'PREDANA' } })
  return 'PREDANA'
}

/**
 * Po smazání (prázdné) etapy: založení etapy vrátilo zakázku z PREDANA/VYUCTOVANA
 * do V_REALIZACI — když je teď poslední zbylá etapa kompletně vyúčtovaná, nic už
 * realizaci nedrží a zakázka se vrací do VYUCTOVANA.
 */
export async function vratZakazkuPoSmazaniEtapy(
  tx: TxClient,
  zakazkaId: string,
): Promise<ZakazkaStav | null> {
  const zakazka = await tx.zakazka.findUnique({ where: { id: zakazkaId }, select: { stav: true } })
  if (!zakazka || zakazka.stav !== 'V_REALIZACI') return null

  const posledni = await tx.zakazkaEtapa.findFirst({
    where: { zakazkaId },
    orderBy: { cislo: 'desc' },
    include: { predavaky: { select: { stav: true } }, vyuctovani: { select: { stav: true } } },
  })
  if (!posledni || !etapaKompletni(etapaProgressFromRaw(posledni))) return null

  await tx.zakazka.update({ where: { id: zakazkaId }, data: { stav: 'VYUCTOVANA' } })
  return 'VYUCTOVANA'
}
