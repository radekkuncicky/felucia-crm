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
