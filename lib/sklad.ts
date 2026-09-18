import type { Prisma, SkladPohybTyp } from '@prisma/client'
import { orgPrisma } from './orgPrisma'
import { listUsersWithPermValue } from './zakazkyHelpers'

/**
 * Sklad v2 — zásoba se vede na katalogovém produktu a dopočítává se
 * agregací z deníku SkladPohyb (jediná pravda, žádný zůstatkový sloupec).
 *
 *   naSklade    = PRIJEM_SKLAD − VYDEJ + VRATKA_VYDEJE ± KOREKCE
 *   rezervovano = REZERVACE − STORNO_REZERVACE − VYDEJ + VRATKA_VYDEJE
 *   dostupne    = naSklade − rezervovano
 *
 * Historický STORNO byl migrací rozdělen na STORNO_REZERVACE / VRATKA_VYDEJE;
 * kdyby nějaký zůstal, počítá se jako storno rezervace.
 */

export type StavProduktu = { naSklade: number; rezervovano: number; dostupne: number }

/** Znaménka příspěvku jednotlivých typů pohybu k zůstatkům. */
const VLIV: Record<SkladPohybTyp, { naSklade: number; rezervovano: number }> = {
  PRIJEM_SKLAD:     { naSklade: +1, rezervovano: 0 },
  VYDEJ:            { naSklade: -1, rezervovano: -1 },
  VRATKA_VYDEJE:    { naSklade: +1, rezervovano: +1 },
  KOREKCE:          { naSklade: +1, rezervovano: 0 },
  REZERVACE:        { naSklade: 0,  rezervovano: +1 },
  STORNO_REZERVACE: { naSklade: 0,  rezervovano: -1 },
  STORNO:           { naSklade: 0,  rezervovano: -1 },
}

/**
 * orgPrisma klient nebo transakce z něj — strukturální typ, aby šly použít oba
 * (generické delegáty se přes union nedají volat).
 */
type Db = {
  skladPohyb: {
    findMany(args: {
      where: Prisma.SkladPohybWhereInput
      select: { productId: true; typ: true; mnozstvi: true }
    }): Promise<{ productId: string | null; typ: SkladPohybTyp; mnozstvi: Prisma.Decimal }[]>
  }
}

/**
 * Kolik je na položce zakázky aktuálně rezervováno (rezervace − storna − výdeje + vrátky).
 * Storno rezervace musí vracet právě tohle, ne mnozstvi položky — rezervovat se dá jiné množství.
 */
export async function rezervovanoPolozky(db: Db, orgId: string, polozkaId: string) {
  const rows = await db.skladPohyb.findMany({
    where: { orgId, polozkaId },
    select: { productId: true, typ: true, mnozstvi: true },
  })
  return round3(rows.reduce((sum, r) => sum + VLIV[r.typ].rezervovano * Number(r.mnozstvi), 0))
}

/**
 * Zůstatky produktů org. Bez `productIds` vrátí všechny produkty, které mají
 * alespoň jeden pohyb; produkt bez pohybů v mapě není (= samé nuly).
 * Sčítá se v JS — deník je malý a takhle to nepotřebuje raw SQL (RLS kontext).
 */
export async function stavSkladu(db: Db, orgId: string, productIds?: string[]) {
  const rows = await db.skladPohyb.findMany({
    where: { orgId, productId: productIds ? { in: productIds } : { not: null } },
    select: { productId: true, typ: true, mnozstvi: true },
  })
  const map = new Map<string, StavProduktu>()
  for (const r of rows) {
    if (!r.productId) continue
    const s = map.get(r.productId) ?? { naSklade: 0, rezervovano: 0, dostupne: 0 }
    const q = Number(r.mnozstvi)
    s.naSklade += VLIV[r.typ].naSklade * q
    s.rezervovano += VLIV[r.typ].rezervovano * q
    map.set(r.productId, s)
  }
  map.forEach(s => {
    s.naSklade = round3(s.naSklade)
    s.rezervovano = round3(s.rezervovano)
    s.dostupne = round3(s.naSklade - s.rezervovano)
  })
  return map
}

export async function stavProduktu(db: Db, orgId: string, productId: string): Promise<StavProduktu> {
  const map = await stavSkladu(db, orgId, [productId])
  return map.get(productId) ?? { naSklade: 0, rezervovano: 0, dostupne: 0 }
}

/**
 * Hodnota zásoby a otevřených rezervací v nákupních cenách — správně
 * množství × cena po produktu (produkt bez pohybu s cenou se do hodnoty nepočítá).
 */
export async function hodnotaSkladu(db: Db, orgId: string, ceny: Map<string, number | null>) {
  const stav = await stavSkladu(db, orgId)
  let zasoba = 0
  let rezervace = 0
  stav.forEach((s, productId) => {
    const cena = ceny.get(productId)
    if (cena == null) return
    zasoba += Math.max(s.naSklade, 0) * cena
    rezervace += Math.max(s.rezervovano, 0) * cena
  })
  return { zasoba, rezervace }
}

/**
 * Po rezervaci / výdeji: pokud dostupné množství kleslo na minimum produktu
 * nebo pod něj, upozornit uživatele se skladem PLNY. Proti spamu se nová
 * notifikace nezakládá, dokud pro tentýž produkt visí nepřečtená.
 * Volat až po commitu transakce.
 */
export async function zkontrolujMinimum(orgId: string, productId: string) {
  const db = orgPrisma(orgId)
  const product = await db.product.findFirst({
    where: { id: productId, orgId },
    select: { nazev: true, kod: true, jednotka: true, minMnozstvi: true },
  })
  if (!product || product.minMnozstvi == null) return
  const stav = await stavProduktu(db, orgId, productId)
  const min = Number(product.minMnozstvi)
  if (stav.dostupne > min) return

  const url = `/products/${productId}`
  const users = await listUsersWithPermValue(orgId, 'sklad', 'PLNY')
  if (users.length === 0) return
  const existujici = await db.notification.findMany({
    where: { orgId, typ: 'SKLAD_MINIMUM', url, precteno: false, userId: { in: users.map(u => u.id) } },
    select: { userId: true },
  })
  const uzMa = new Set(existujici.map(n => n.userId))
  const zprava = `Dochází zásoba: ${product.kod ? `${product.kod} ` : ''}${product.nazev} — dostupné ${formatQty(stav.dostupne)} ${product.jednotka}, minimum ${formatQty(min)}`
  const data = users.filter(u => !uzMa.has(u.id)).map(u => ({ orgId, userId: u.id, typ: 'SKLAD_MINIMUM', zprava, url }))
  if (data.length) await db.notification.createMany({ data })
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000
}

function formatQty(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}
