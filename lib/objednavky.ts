import type { Prisma, ObjednavkaStav } from '@prisma/client'
import { prisma } from './prisma'
import type { OrgPrismaClient } from './orgPrisma'
import { createWithUniqueKod } from './uniqueKod'

/**
 * Objednávky materiálu u dodavatele — číslování, založení ze zakázky (seskupené
 * po dodavatelích), příjem s částečnými dodávkami.
 */

export const OBJEDNAVKA_INCLUDE = {
  dodavatel: { select: { id: true, nazev: true, email: true, telefon: true, kontaktOsoba: true, ico: true, dic: true, ulice: true, mesto: true, psc: true } },
  zakazka: { select: { id: true, cislo: true, nazev: true, mistoStavby: true, montazOd: true } },
  vytvoril: { select: { id: true, jmeno: true } },
  polozky: { orderBy: { poradi: 'asc' as const } },
} satisfies Prisma.ObjednavkaInclude

export type ObjednavkaFull = Prisma.ObjednavkaGetPayload<{ include: typeof OBJEDNAVKA_INCLUDE }>

/** OBJ-26-001 — per org a rok, stejně jako vyúčtování (VYU-). Bare prisma, jde o čtení čísla. */
export async function generateObjednavkaCislo(orgId: string): Promise<string> {
  const year = new Date().getFullYear().toString().slice(2)
  const prefix = `OBJ-${year}-`
  const last = await prisma.objednavka.findFirst({
    where: { orgId, cislo: { startsWith: prefix } },
    orderBy: { cislo: 'desc' },
    select: { cislo: true },
  })
  const lastNum = last ? parseInt(last.cislo.slice(prefix.length), 10) : 0
  return `${prefix}${String(lastNum + 1).padStart(3, '0')}`
}

/** Objednávka do JSON: Decimal → number, nákupní ceny jen za financeNakupky. */
export function serializeObjednavka(o: ObjednavkaFull, showNakupky: boolean) {
  const polozky = o.polozky.map(p => ({
    id: p.id,
    productId: p.productId,
    zakazkaPolozkaId: p.zakazkaPolozkaId,
    objednaciKod: p.objednaciKod,
    nazev: p.nazev,
    mnozstvi: Number(p.mnozstvi),
    jednotka: p.jednotka,
    nakupniCena: showNakupky && p.nakupniCena !== null ? Number(p.nakupniCena) : null,
    mnozstviDoruceno: Number(p.mnozstviDoruceno),
    poradi: p.poradi,
  }))
  const celkem = showNakupky ? polozky.reduce((s, p) => s + (p.nakupniCena ?? 0) * p.mnozstvi, 0) : null
  return {
    id: o.id,
    cislo: o.cislo,
    stav: o.stav,
    dodavatel: o.dodavatel,
    zakazka: o.zakazka ? { ...o.zakazka, montazOd: o.zakazka.montazOd?.toISOString() ?? null } : null,
    vytvoril: o.vytvoril,
    zobrazitCeny: o.zobrazitCeny,
    pozadovanyTermin: o.pozadovanyTermin?.toISOString() ?? null,
    poznamka: o.poznamka,
    odeslano: o.odeslano?.toISOString() ?? null,
    doruceno: o.doruceno?.toISOString() ?? null,
    vytvoreno: o.vytvoreno.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    polozky,
    celkem,
    pocetPolozek: polozky.length,
    pocetDorucenych: polozky.filter(p => p.mnozstviDoruceno >= p.mnozstvi).length,
  }
}

export type NovaObjednavkaVstup = {
  dodavatelId: string
  pozadovanyTermin?: string | null
  poznamka?: string | null
  zobrazitCeny?: boolean
  polozky: { zakazkaPolozkaId: string; mnozstvi: number }[]
}

/**
 * Založí objednávky ze zakázky — jednu na každého dodavatele ve vstupu.
 * Snapshot obj. kódu a nákupní ceny z vazby produkt↔dodavatel (fallback: obecný kód
 * produktu / nákupka položky). Položky zakázky přejdou na OBJEDNANO.
 */
export async function vytvorObjednavkyZeZakazky(
  db: OrgPrismaClient,
  orgId: string,
  userId: string,
  zakazkaId: string,
  skupiny: NovaObjednavkaVstup[],
) {
  const polozkaIds = skupiny.flatMap(s => s.polozky.map(p => p.zakazkaPolozkaId))
  const polozky = await db.zakazkaPolozka.findMany({
    where: { id: { in: polozkaIds }, zakazkaId, zakazka: { orgId } },
    include: { product: { select: { id: true, objednaciKod: true, nakladovaCena: true, dodavatele: { select: { dodavatelId: true, objednaciKod: true, nakupniCena: true } } } } },
  })
  const byId = new Map(polozky.map(p => [p.id, p]))
  if (byId.size !== new Set(polozkaIds).size) throw new ObjednavkaChyba('Některá položka zakázky neexistuje', 404)

  const dodavatele = await db.dodavatel.findMany({
    where: { orgId, id: { in: skupiny.map(s => s.dodavatelId) }, aktivni: true },
    select: { id: true },
  })
  if (dodavatele.length !== new Set(skupiny.map(s => s.dodavatelId)).size) throw new ObjednavkaChyba('Dodavatel neexistuje nebo je neaktivní', 400)

  const vytvorene: string[] = []
  for (const skupina of skupiny) {
    if (skupina.polozky.length === 0) continue
    const objednavka = await createWithUniqueKod(
      () => generateObjednavkaCislo(orgId),
      cislo => db.$transaction(async tx => {
        const o = await tx.objednavka.create({
          data: {
            orgId,
            cislo,
            dodavatelId: skupina.dodavatelId,
            zakazkaId,
            vytvorilId: userId,
            zobrazitCeny: skupina.zobrazitCeny ?? false,
            pozadovanyTermin: skupina.pozadovanyTermin ? new Date(skupina.pozadovanyTermin) : null,
            poznamka: skupina.poznamka?.trim() || null,
            polozky: {
              create: skupina.polozky.map((vstup, idx) => {
                const p = byId.get(vstup.zakazkaPolozkaId)!
                const vazba = p.product?.dodavatele.find(d => d.dodavatelId === skupina.dodavatelId)
                const mnozstvi = Number(vstup.mnozstvi)
                if (!Number.isFinite(mnozstvi) || mnozstvi <= 0) throw new ObjednavkaChyba(`Neplatné množství u položky ${p.nazev}`, 400)
                return {
                  orgId,
                  productId: p.productId,
                  zakazkaPolozkaId: p.id,
                  objednaciKod: vazba?.objednaciKod ?? p.product?.objednaciKod ?? p.kod ?? null,
                  nazev: p.nazev,
                  mnozstvi,
                  jednotka: p.jednotka,
                  nakupniCena: vazba?.nakupniCena ?? p.nakupniCena ?? p.product?.nakladovaCena ?? null,
                  poradi: idx,
                }
              }),
            },
          },
          select: { id: true, cislo: true },
        })
        await tx.zakazkaPolozka.updateMany({
          where: { id: { in: skupina.polozky.map(p => p.zakazkaPolozkaId) }, stav: 'CEKA' },
          data: { stav: 'OBJEDNANO' },
        })
        await tx.auditLog.create({
          data: {
            orgId, userId, typAkce: 'CREATE', typZaznamu: 'Objednavka', zaznamId: o.id, zaznamNazev: o.cislo,
            zmeny: { zakazkaId, dodavatelId: skupina.dodavatelId, polozek: skupina.polozky.length },
          },
        })
        return o
      }),
    )
    vytvorene.push(objednavka.id)
  }
  return vytvorene
}

/**
 * Příjem dodávky (i částečné): navýší doručené množství, zapíše PRIJEM_SKLAD na produkt
 * a u položky zakázky doručené v plné výši rovnou REZERVACE (materiál je pro tu zakázku).
 * Vrací nový stav objednávky.
 */
export async function prijmoutDodavku(
  db: OrgPrismaClient,
  orgId: string,
  userId: string,
  objednavka: ObjednavkaFull,
  prijem: { id: string; mnozstvi: number }[],
): Promise<{ stav: ObjednavkaStav; productIds: string[] }> {
  if (objednavka.stav === 'ZRUSENA' || objednavka.stav === 'DORUCENA') {
    throw new ObjednavkaChyba('Objednávka je uzavřená', 422)
  }
  const byId = new Map(objednavka.polozky.map(p => [p.id, p]))
  const radky = prijem
    .map(r => ({ polozka: byId.get(r.id), mnozstvi: Number(r.mnozstvi) }))
    .filter(r => r.mnozstvi > 0)
  if (radky.length === 0) throw new ObjednavkaChyba('Nic k přijetí', 400)
  for (const r of radky) {
    if (!r.polozka) throw new ObjednavkaChyba('Položka objednávky neexistuje', 404)
    if (!Number.isFinite(r.mnozstvi)) throw new ObjednavkaChyba('Neplatné množství', 400)
    const zbyva = Number(r.polozka.mnozstvi) - Number(r.polozka.mnozstviDoruceno)
    if (r.mnozstvi > zbyva + 1e-9) throw new ObjednavkaChyba(`U položky ${r.polozka.nazev} zbývá přijmout jen ${zbyva}`, 400)
  }

  const productIds = new Set<string>()
  const novyStav = await db.$transaction(async tx => {
    for (const r of radky) {
      const p = r.polozka!
      const doruceno = Number(p.mnozstviDoruceno) + r.mnozstvi
      await tx.objednavkaPolozka.update({ where: { id: p.id }, data: { mnozstviDoruceno: doruceno } })

      const zakazkaPolozka = p.zakazkaPolozkaId
        ? await tx.zakazkaPolozka.findFirst({ where: { id: p.zakazkaPolozkaId }, select: { id: true, stav: true, nakupniCena: true } })
        : null

      if (p.productId) {
        productIds.add(p.productId)
        await tx.skladPohyb.create({
          data: {
            orgId,
            typ: 'PRIJEM_SKLAD',
            productId: p.productId,
            zakazkaId: objednavka.zakazkaId,
            polozkaId: null,
            nazev: p.nazev,
            mnozstvi: r.mnozstvi,
            nakupniCena: p.nakupniCena,
            duvod: `Dodávka k objednávce ${objednavka.cislo}`,
            vytvorilId: userId,
          },
        })
      }

      // Položka zakázky doručená celá → rovnou rezervace pro tu zakázku
      const cele = doruceno + 1e-9 >= Number(p.mnozstvi)
      if (cele && zakazkaPolozka && objednavka.zakazkaId && (zakazkaPolozka.stav === 'OBJEDNANO' || zakazkaPolozka.stav === 'CEKA')) {
        await tx.skladPohyb.create({
          data: {
            orgId,
            typ: 'REZERVACE',
            productId: p.productId,
            zakazkaId: objednavka.zakazkaId,
            polozkaId: zakazkaPolozka.id,
            nazev: p.nazev,
            mnozstvi: Number(p.mnozstvi),
            nakupniCena: p.nakupniCena ?? zakazkaPolozka.nakupniCena,
            duvod: `Doručeno objednávkou ${objednavka.cislo}`,
            vytvorilId: userId,
          },
        })
        await tx.zakazkaPolozka.update({
          where: { id: zakazkaPolozka.id },
          data: { stav: 'NASKLADNENO', ...(zakazkaPolozka.nakupniCena === null && p.nakupniCena !== null ? { nakupniCena: p.nakupniCena } : {}) },
        })
      }
    }

    const vsechny = await tx.objednavkaPolozka.findMany({ where: { objednavkaId: objednavka.id }, select: { mnozstvi: true, mnozstviDoruceno: true } })
    const vseDoruceno = vsechny.every(p => Number(p.mnozstviDoruceno) + 1e-9 >= Number(p.mnozstvi))
    const stav: ObjednavkaStav = vseDoruceno ? 'DORUCENA' : 'CASTECNE_DORUCENA'
    await tx.objednavka.update({
      where: { id: objednavka.id },
      data: { stav, doruceno: vseDoruceno ? new Date() : null },
    })
    await tx.auditLog.create({
      data: {
        orgId, userId, typAkce: 'UPDATE', typZaznamu: 'Objednavka', zaznamId: objednavka.id, zaznamNazev: objednavka.cislo,
        zmeny: { prijem: radky.map(r => ({ polozka: r.polozka!.nazev, mnozstvi: r.mnozstvi })), stav },
      },
    })
    return stav
  })
  return { stav: novyStav, productIds: Array.from(productIds) }
}

export class ObjednavkaChyba extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}
