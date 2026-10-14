/** Výpočty cen nabídky — sdílené mezi mobilním obchodním API a testy. */

type ItemLike = { mnozstvi: unknown; cenaZaKus: unknown; sleva: unknown }

/** Součet položek bez DPH; položková sleva je v % */
export function quoteCelkemBezDph(items: ItemLike[]): number {
  return items.reduce(
    (s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus) * (1 - Number(i.sleva ?? 0) / 100),
    0,
  )
}

/** Celkem s DPH podle sazby nabídky */
export function quoteCelkemSDph(items: ItemLike[], dphSazba: number): number {
  return quoteCelkemBezDph(items) * (1 + dphSazba / 100)
}

/** Řádek zakázky/vyúčtování bez DPH: množství × cena × (1 − sleva %) */
export function radekBezDph(p: { mnozstvi: unknown; prodejniCena: unknown; sleva?: unknown }): number {
  return Number(p.mnozstvi) * Number(p.prodejniCena ?? 0) * (1 - Number(p.sleva ?? 0) / 100)
}

/** Jednotková cena po položkové slevě */
export function cenaPoSleve(cena: unknown, sleva: unknown): number {
  return Number(cena ?? 0) * (1 - Number(sleva ?? 0) / 100)
}

/** Sleva z požadavku → 0–100 %, `undefined` když chybí nebo je neplatná */
export function slevaProcenta(v: unknown): number | undefined {
  if (v == null || v === '') return undefined
  const n = Number(v)
  if (!Number.isFinite(n)) return undefined
  return Math.min(100, Math.max(0, n))
}
