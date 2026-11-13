import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { radekBezDph } from '@/lib/quoteMath'

export interface ZakazkaFinance {
  /** Cena aktivní nabídky OP bez DPH (po slevách) */
  cenaOP: number | null
  /** Marže aktivní nabídky v % — jen když jsou nákupní ceny */
  cnMarzeProc: number | null
  /** Schválená vyúčtování bez DPH */
  vyuctovanoSchvaleno: number
  /** Všechna vyúčtování vč. návrhů bez DPH */
  vyuctovaniCelkem: number
  pocetVyuctovani: number
  /** vyuctovaniCelkem − cenaOP */
  rozdilVsOP: number | null
  /** Nákupní cena naskladněných a vydaných položek */
  nakupniTotal: number
}

/**
 * Finanční souhrn zakázky (cena dle OP × vyúčtování × nákupky). Sdílí ho řádek
 * v hlavičce a záložka Finance — `cache` zaručí jeden výpočet na request.
 * Oprávnění (financeProdejni / financeNakupky) řeší volající při zobrazení.
 */
export const zakazkaFinance = cache(async (zakazkaId: string, orgId: string): Promise<ZakazkaFinance | null> => {
  const zakazka = await prisma.zakazka.findFirst({
    where: { id: zakazkaId, orgId },
    select: {
      opId: true,
      polozky: { select: { stav: true, nakupniCena: true, mnozstvi: true } },
      vyuctovani: { select: { stav: true, polozky: { select: { mnozstvi: true, prodejniCena: true, sleva: true } } } },
    },
  })
  if (!zakazka) return null

  let cnMarzeProc: number | null = null
  let cenaOP: number | null = null
  if (zakazka.opId) {
    const q = await prisma.quote.findFirst({
      where: { dealId: zakazka.opId, orgId, aktivni: true },
      include: { items: { include: { product: { select: { nakladovaCena: true } } } } },
    })
    if (q) {
      const koef = (i: { sleva: unknown }) => 1 - Number(i.sleva ?? 0) / 100
      const prodej = q.items.reduce((s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus) * koef(i), 0)
      const nakup = q.items.reduce((s, i) => {
        const nakladovaCena = i.nakupniCena != null ? Number(i.nakupniCena) : (i.product?.nakladovaCena != null ? Number(i.product.nakladovaCena) : Number(i.cenaZaKus))
        return s + Number(i.mnozstvi) * nakladovaCena * koef(i)
      }, 0)
      const hasNakupniData = q.items.some(i => i.nakupniCena != null || Number(i.product?.nakladovaCena ?? 0) > 0)
      if (prodej > 0) cenaOP = prodej
      if (prodej > 0 && hasNakupniData) cnMarzeProc = Math.round((prodej - nakup) / prodej * 1000) / 10
    }
  }

  const sum = (list: typeof zakazka.vyuctovani) => list.reduce((s, v) => s + v.polozky.reduce((t, p) => t + radekBezDph(p), 0), 0)
  const vyuctovaniCelkem = sum(zakazka.vyuctovani)

  return {
    cenaOP,
    cnMarzeProc,
    vyuctovanoSchvaleno: sum(zakazka.vyuctovani.filter(v => v.stav === 'SCHVALENO')),
    vyuctovaniCelkem,
    pocetVyuctovani: zakazka.vyuctovani.length,
    rozdilVsOP: cenaOP !== null ? vyuctovaniCelkem - cenaOP : null,
    nakupniTotal: zakazka.polozky
      .filter(p => p.stav === 'NASKLADNENO' || p.stav === 'VYDANO')
      .reduce((s, p) => s + Number(p.nakupniCena ?? 0) * Number(p.mnozstvi), 0),
  }
})
