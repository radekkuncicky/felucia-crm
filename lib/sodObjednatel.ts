import type { OrgPrismaClient } from '@/lib/orgPrisma'
import { rozlozAdresu } from '@/lib/klientAdresa'
import { formatPsc } from '@/lib/ares'

// Objednatel a místo instalace ve smlouvě o dílo: sídlo / trvalé bydliště
// objednatele se nesmí tiše zaměnit s místem instalace. Formulář musí
// výslovně potvrdit „místo instalace = sídlo“, nebo zadat jiné místo.

export interface SodObjednatelVstup {
  klientAdresa?: unknown
  adresaDila?: unknown
  mistoShodne?: unknown
  klientIco?: unknown
  klientDic?: unknown
  /** části sídla z ARES (přesnější než rozklad textu) */
  sidloCasti?: unknown
}

export interface SodObjednatel {
  klientAdresa: string
  adresaDila: string
  klientIco: string | null
  klientDic: string | null
  sidloCasti: { ulice: string | null; mesto: string; psc: string | null } | null
}

const t = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Ověří potvrzení sídla a místa instalace; vrací normalizované hodnoty, nebo chybovou hlášku. */
export function overObjednatele(v: SodObjednatelVstup): SodObjednatel | string {
  const klientAdresa = t(v.klientAdresa)
  if (!klientAdresa) return 'Vyplňte sídlo / trvalé bydliště objednatele'
  if (v.mistoShodne !== true && v.mistoShodne !== false) return 'Potvrďte, zda je místo instalace shodné se sídlem / bydlištěm objednatele'
  const adresaDila = v.mistoShodne ? klientAdresa : t(v.adresaDila)
  if (!adresaDila) return 'Vyplňte místo instalace'

  const c = v.sidloCasti && typeof v.sidloCasti === 'object' ? (v.sidloCasti as Record<string, unknown>) : null
  const sidloCasti = c && t(c.mesto) ? { ulice: t(c.ulice) || null, mesto: t(c.mesto), psc: t(c.psc) ? formatPsc(t(c.psc)) : null } : null

  return {
    klientAdresa,
    adresaDila,
    klientIco: t(v.klientIco, 20) || null,
    klientDic: t(v.klientDic, 20) || null,
    sidloCasti,
  }
}

/**
 * Doplní do karty klienta sídlo / IČO / DIČ zadané ve smlouvě — jen prázdná pole,
 * vyplněná se nepřepisují (ať se chyba u další smlouvy neopakuje).
 */
export async function doplnKlientaZeSmlouvy(db: OrgPrismaClient, orgId: string, dealId: string, o: SodObjednatel) {
  const deal = await db.deal.findFirst({
    where: { id: dealId, orgId },
    select: { client: { select: { id: true, ulice: true, mesto: true, psc: true, ico: true, dic: true } } },
  })
  const k = deal?.client
  if (!k) return
  const data: Record<string, string> = {}
  if (!k.ulice && !k.mesto && !k.psc) {
    const casti = o.sidloCasti ?? rozlozAdresu(o.klientAdresa)
    if (casti) {
      if (casti.ulice) data.ulice = casti.ulice
      data.mesto = casti.mesto
      if (casti.psc) data.psc = casti.psc
    }
  }
  if (!k.ico && o.klientIco) data.ico = o.klientIco
  if (!k.dic && o.klientDic) data.dic = o.klientDic
  if (Object.keys(data).length > 0) await db.client.update({ where: { id: k.id }, data })
}
