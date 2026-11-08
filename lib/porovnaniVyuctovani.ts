// Porovnání vyúčtování s cenovou nabídkou (CN) — čistě informativní přehled.
// Párování položek: productId → kód → název (bez diakritiky) + jednotka.
// Víc řádků vyúčtování se může sečíst do jedné položky CN (rozdělená položka).

import { bezDiakritiky } from '@/lib/hledani'
import { cenaPoSleve } from '@/lib/quoteMath'

export interface PolozkaCN {
  productId: string | null
  kod: string | null
  nazev: string
  jednotka: string | null
  mnozstvi: number
  cenaZaKus: number
  sleva: number
}

export interface PolozkaVyu {
  productId: string | null
  kod: string | null
  nazev: string
  jednotka: string | null
  mnozstvi: number
  prodejniCena: number
  sleva: number
}

export type StavRadku = 'SHODA' | 'ROZDIL' | 'CHYBI' | 'NAVIC'

export interface RadekPorovnani {
  stav: StavRadku
  nazev: string
  jednotka: string
  cn: { mnozstvi: number; cenaJedn: number; celkem: number } | null
  vyu: { mnozstvi: number; cenaJedn: number; celkem: number } | null
  /** vyúčtováno − CN (bez DPH) */
  rozdil: number
}

export interface PorovnaniVyuctovani {
  radky: RadekPorovnani[]
  souhrn: { cnCelkem: number; vyuCelkem: number; rozdil: number; shoda: number; rozdilu: number; chybi: number; navic: number }
}

const TOLERANCE_KC = 0.5
const r2 = (n: number) => Math.round(n * 100) / 100
const normNazev = (s: string) => bezDiakritiky(s).replace(/[^a-z0-9]+/g, ' ').trim()
const normJedn = (s: string | null) => bezDiakritiky(s ?? 'ks').replace(/\./g, '').trim() || 'ks'

export function porovnejVyuctovaniSCN(cn: PolozkaCN[], vyu: PolozkaVyu[]): PorovnaniVyuctovani {
  const prirazeno: PolozkaVyu[][] = cn.map(() => [])
  const navic: PolozkaVyu[] = []

  const klice: ((p: PolozkaCN | PolozkaVyu) => string | null)[] = [
    (p) => (p.productId ? `p:${p.productId}` : null),
    (p) => (p.kod?.trim() ? `k:${p.kod.trim().toLowerCase()}` : null),
    (p) => `n:${normNazev(p.nazev)}|${normJedn(p.jednotka)}`,
  ]

  for (const v of vyu) {
    let idx = -1
    for (const klic of klice) {
      const kv = klic(v)
      if (!kv) continue
      const kandidati = cn.map((c, i) => (klic(c) === kv ? i : -1)).filter((i) => i >= 0)
      if (kandidati.length === 0) continue
      // přednost má položka CN, ke které ještě nic nepřiřadilo
      idx = kandidati.find((i) => prirazeno[i].length === 0) ?? kandidati[0]
      break
    }
    if (idx >= 0) prirazeno[idx].push(v)
    else navic.push(v)
  }

  const radky: RadekPorovnani[] = []
  cn.forEach((c, i) => {
    const cnCelkem = r2(c.mnozstvi * cenaPoSleve(c.cenaZaKus, c.sleva))
    const cnData = { mnozstvi: c.mnozstvi, cenaJedn: r2(cenaPoSleve(c.cenaZaKus, c.sleva)), celkem: cnCelkem }
    const vs = prirazeno[i]
    if (vs.length === 0) {
      radky.push({ stav: 'CHYBI', nazev: c.nazev, jednotka: c.jednotka ?? 'ks', cn: cnData, vyu: null, rozdil: -cnCelkem })
      return
    }
    const mnozstvi = vs.reduce((s, v) => s + v.mnozstvi, 0)
    const celkem = r2(vs.reduce((s, v) => s + v.mnozstvi * cenaPoSleve(v.prodejniCena, v.sleva), 0))
    const rozdil = r2(celkem - cnCelkem)
    const shoda = Math.abs(mnozstvi - c.mnozstvi) < 1e-9 && Math.abs(rozdil) <= TOLERANCE_KC
    radky.push({
      stav: shoda ? 'SHODA' : 'ROZDIL',
      nazev: c.nazev,
      jednotka: c.jednotka ?? 'ks',
      cn: cnData,
      vyu: { mnozstvi, cenaJedn: mnozstvi ? r2(celkem / mnozstvi) : 0, celkem },
      rozdil: shoda ? 0 : rozdil,
    })
  })
  for (const v of navic) {
    const celkem = r2(v.mnozstvi * cenaPoSleve(v.prodejniCena, v.sleva))
    radky.push({
      stav: 'NAVIC', nazev: v.nazev, jednotka: v.jednotka ?? 'ks', cn: null,
      vyu: { mnozstvi: v.mnozstvi, cenaJedn: r2(cenaPoSleve(v.prodejniCena, v.sleva)), celkem }, rozdil: celkem,
    })
  }

  const cnCelkem = r2(radky.reduce((s, r) => s + (r.cn?.celkem ?? 0), 0))
  const vyuCelkem = r2(radky.reduce((s, r) => s + (r.vyu?.celkem ?? 0), 0))
  const pocet = (st: StavRadku) => radky.filter((r) => r.stav === st).length
  return {
    radky,
    souhrn: { cnCelkem, vyuCelkem, rozdil: r2(vyuCelkem - cnCelkem), shoda: pocet('SHODA'), rozdilu: pocet('ROZDIL'), chybi: pocet('CHYBI'), navic: pocet('NAVIC') },
  }
}
