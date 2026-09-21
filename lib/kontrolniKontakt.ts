// Kontrolní kontakt po odeslání nabídky — sdílená předvolba pro web i mobil.

export const KONTROLNI_KONTAKT_DNI = 3
export const KONTROLNI_KONTAKT_CIL = 'Ověřit přijetí nabídky a domluvit další krok'

/** Datum za N pracovních dní (přeskakuje So/Ne), čas 09:00 místního času. */
export function zaPracovnichDni(dni: number, od: Date = new Date()): Date {
  const d = new Date(od)
  d.setHours(9, 0, 0, 0)
  let zbyva = Math.max(0, Math.floor(dni))
  while (zbyva > 0) {
    d.setDate(d.getDate() + 1)
    const den = d.getDay()
    if (den !== 0 && den !== 6) zbyva--
  }
  return d
}

/** YYYY-MM-DD v místním čase (pro <input type="date">). */
export function toDateInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export type KontrolniKontaktTyp = 'HOVOR' | 'EMAIL'

/** Popis aktivity kontrolního kontaktu podle nabídky. */
export function kontrolniKontaktPopis(quoteKod: string | null, typ: KontrolniKontaktTyp): string {
  const co = typ === 'HOVOR' ? 'Zavolat' : 'Napsat'
  return `${co} klientovi k nabídce${quoteKod ? ` ${quoteKod}` : ''}`
}
