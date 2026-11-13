import { createHmac, timingSafeEqual } from 'crypto'
import type { Prisma } from '@prisma/client'

/**
 * Výkaz práce techniků — hodiny + km (VYJEZD) a vlastní položky (POLOZKA: materiál, odměna…)
 * k zakázce nebo servisnímu výjezdu. Technik (OSVČ) si z nevyfakturovaných záznamů dělá
 * podklad k faktuře firmě; „Vyfakturováno“ je uzavře do VykazFakturace.
 * Sazby jsou technikova odměna = náklad firmy (ne prodejní cena).
 */

export const VYKAZ_LIMITY = {
  hodinyMin: 0.25,
  hodinyMax: 24,
  kmMax: 2000,
  castkaMax: 200_000,
  popisMax: 200,
  poznamkaMax: 1000,
  sazbaMax: 100_000,
} as const

type Num = Prisma.Decimal | number | string | null | undefined
export const num = (v: Num): number => (v == null ? 0 : Number(v))
const round2 = (n: number) => Math.round(n * 100) / 100

export type VykazRadekDb = {
  typ: 'VYJEZD' | 'POLOZKA'
  hodiny: Num
  km: number
  sazbaHodina: Num
  sazbaKm: Num
  castka: Num
}

/** Částka jednoho záznamu v Kč */
export function castkaZaznamu(z: VykazRadekDb): number {
  if (z.typ === 'POLOZKA') return round2(num(z.castka))
  return round2(num(z.hodiny) * num(z.sazbaHodina) + z.km * num(z.sazbaKm))
}

export type VykazSoucty = {
  hodiny: number
  km: number
  castkaHodiny: number
  castkaKm: number
  castkaPolozky: number
  castka: number
  pocet: number
}

export function souctyVykazu(zaznamy: VykazRadekDb[]): VykazSoucty {
  const s: VykazSoucty = { hodiny: 0, km: 0, castkaHodiny: 0, castkaKm: 0, castkaPolozky: 0, castka: 0, pocet: zaznamy.length }
  for (const z of zaznamy) {
    if (z.typ === 'POLOZKA') {
      s.castkaPolozky += num(z.castka)
    } else {
      s.hodiny += num(z.hodiny)
      s.km += z.km
      s.castkaHodiny += num(z.hodiny) * num(z.sazbaHodina)
      s.castkaKm += z.km * num(z.sazbaKm)
    }
  }
  s.hodiny = round2(s.hodiny)
  s.castkaHodiny = round2(s.castkaHodiny)
  s.castkaKm = round2(s.castkaKm)
  s.castkaPolozky = round2(s.castkaPolozky)
  s.castka = round2(s.castkaHodiny + s.castkaKm + s.castkaPolozky)
  return s
}

/** Prisma include pro zakázku/servis u záznamu (číslo + název do tabulek) */
export const VYKAZ_INCLUDE = {
  zakazka: { select: { id: true, cislo: true, nazev: true } },
  servisniZakazka: {
    select: {
      id: true, cislo: true, popis: true,
      klient: { select: { jmeno: true, prijmeni: true } },
      kontrakt: { select: { klient: { select: { jmeno: true, prijmeni: true } } } },
    },
  },
} satisfies Prisma.VykazPraceInclude

type VykazSInclude = Prisma.VykazPraceGetPayload<{ include: typeof VYKAZ_INCLUDE }>

/** Číslo + název zakázky / servisního výjezdu pro zobrazení */
export function zakazkaZaznamu(z: VykazSInclude): { druh: 'ZAKAZKA' | 'SERVIS'; id: string; cislo: string; nazev: string } {
  if (z.zakazka) return { druh: 'ZAKAZKA', id: z.zakazka.id, cislo: z.zakazka.cislo, nazev: z.zakazka.nazev }
  const s = z.servisniZakazka
  const k = s?.kontrakt?.klient ?? s?.klient
  const klient = k ? `${k.jmeno} ${k.prijmeni}`.trim() : ''
  const nazev = ['Servis', klient, s?.popis ? s.popis.slice(0, 60) : ''].filter(Boolean).join(' – ')
  return { druh: 'SERVIS', id: s?.id ?? '', cislo: s?.cislo ?? '—', nazev }
}

/** JSON záznamu pro appku */
export function serializeZaznam(z: VykazSInclude) {
  return {
    id: z.id,
    typ: z.typ,
    datum: z.datum.toISOString().slice(0, 10),
    hodiny: num(z.hodiny),
    km: z.km,
    sazbaHodina: z.sazbaHodina == null ? null : num(z.sazbaHodina),
    sazbaKm: z.sazbaKm == null ? null : num(z.sazbaKm),
    popis: z.popis,
    poznamka: z.poznamka,
    castka: castkaZaznamu(z),
    vyfakturovano: !!z.fakturaceId,
    fakturaceId: z.fakturaceId,
    zakazka: zakazkaZaznamu(z),
  }
}

// ── Validace vstupu ─────────────────────────────────────────────────────────

export type VykazVstup = {
  typ: 'VYJEZD' | 'POLOZKA'
  datum: Date
  hodiny: number
  km: number
  popis: string | null
  castka: number | null
  poznamka: string | null
}

/** Datum `YYYY-MM-DD` → Date (UTC půlnoc, sloupec je @db.Date); ne v budoucnu (+1 den tolerance pásma) a max 1 rok zpět */
export function parseDatum(v: unknown, now = new Date()): Date | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(`${v}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return null
  const zitra = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  if (d.getTime() > zitra) return null
  if (d.getTime() < zitra - 366 * 86400_000) return null
  return d
}

export function parseVykazVstup(body: Record<string, unknown>, now = new Date()): VykazVstup | string {
  const typ = body.typ === 'POLOZKA' ? 'POLOZKA' : 'VYJEZD'
  const datum = parseDatum(body.datum, now)
  if (!datum) return 'Neplatné datum'
  const poznamka = typeof body.poznamka === 'string' ? body.poznamka.trim().slice(0, VYKAZ_LIMITY.poznamkaMax) || null : null

  if (typ === 'POLOZKA') {
    const popis = typeof body.popis === 'string' ? body.popis.trim() : ''
    if (!popis) return 'Popis položky je povinný'
    if (popis.length > VYKAZ_LIMITY.popisMax) return 'Popis je příliš dlouhý'
    const castka = Number(body.castka)
    if (!Number.isFinite(castka) || castka < 1 || castka > VYKAZ_LIMITY.castkaMax) return 'Neplatná částka'
    return { typ, datum, hodiny: 0, km: 0, popis, castka: round2(castka), poznamka }
  }

  const hodiny = Number(body.hodiny ?? 0)
  const km = Number(body.km ?? 0)
  if (!Number.isFinite(hodiny) || hodiny < 0 || hodiny > VYKAZ_LIMITY.hodinyMax) return 'Neplatný počet hodin'
  if (Math.round(hodiny * 4) !== hodiny * 4) return 'Hodiny zadávej po čtvrthodinách'
  if (!Number.isInteger(km) || km < 0 || km > VYKAZ_LIMITY.kmMax) return 'Neplatný počet km'
  if (hodiny === 0 && km === 0) return 'Zadej hodiny nebo kilometry'
  return { typ, datum, hodiny, km, popis: null, castka: null, poznamka }
}

export function parseSazba(v: unknown): number | null | 'chyba' {
  if (v === null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > VYKAZ_LIMITY.sazbaMax) return 'chyba'
  return round2(n)
}

// ── Podepsaný odkaz na PDF (appka ho otevře v prohlížeči bez Bearer tokenu) ────

export const VYKAZ_PDF_TTL_SEC = 10 * 60

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET
  if (!s) throw new Error('NEXTAUTH_SECRET chybí')
  return s
}

function hmac(userId: string, fakturaceId: string, exp: number): string {
  return createHmac('sha256', secret()).update(`vykaz:${userId}|${fakturaceId}|${exp}`).digest('base64url')
}

/** Relativní URL `/api/vykaz/pdf?…` platná VYKAZ_PDF_TTL_SEC */
export function signVykazPdfUrl(userId: string, fakturaceId: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + VYKAZ_PDF_TTL_SEC
  const q = new URLSearchParams({ u: userId, f: fakturaceId, exp: String(exp), sig: hmac(userId, fakturaceId, exp) })
  return `/api/vykaz/pdf?${q}`
}

export function verifyVykazPdfSignature(
  userId: string | null, fakturaceId: string | null, exp: string | null, sig: string | null, now = Date.now(),
): boolean {
  if (!userId || !fakturaceId || !exp || !sig || !/^\d{1,12}$/.test(exp)) return false
  const expNum = Number(exp)
  if (expNum * 1000 < now) return false
  const expected = Buffer.from(hmac(userId, fakturaceId, expNum))
  const given = Buffer.from(sig)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

// ── Manažerský přehled na zakázce (web, záložka Finance) ─────────────────────

export type VykazZakazkyTechnik = {
  userId: string
  jmeno: string
  soucty: VykazSoucty
  vyfakturovano: number
  pocetVyfakturovano: number
  zaznamy: { id: string; typ: 'VYJEZD' | 'POLOZKA'; datum: Date; hodiny: number; km: number; popis: string | null; poznamka: string | null; castka: number; vyfakturovano: boolean }[]
}

type VykazZakazkyDb = VykazRadekDb & {
  id: string; userId: string; datum: Date; popis: string | null; poznamka: string | null; fakturaceId: string | null
  user: { jmeno: string }
}

/** Seskupí záznamy zakázky po technicích (seřazeno podle nákladu) */
export function vykazZakazkyPoTechnicich(zaznamy: VykazZakazkyDb[]): VykazZakazkyTechnik[] {
  const map = new Map<string, VykazZakazkyDb[]>()
  for (const z of zaznamy) map.set(z.userId, [...(map.get(z.userId) ?? []), z])
  return Array.from(map.entries())
    .map(([userId, zz]: [string, VykazZakazkyDb[]]) => {
      const fakt = zz.filter(z => z.fakturaceId)
      return {
        userId,
        jmeno: zz[0].user.jmeno,
        soucty: souctyVykazu(zz),
        vyfakturovano: souctyVykazu(fakt).castka,
        pocetVyfakturovano: fakt.length,
        zaznamy: zz.map(z => ({
          id: z.id, typ: z.typ, datum: z.datum, hodiny: num(z.hodiny), km: z.km,
          popis: z.popis, poznamka: z.poznamka, castka: castkaZaznamu(z), vyfakturovano: !!z.fakturaceId,
        })),
      }
    })
    .sort((a, b) => b.soucty.castka - a.soucty.castka || b.soucty.hodiny - a.soucty.hodiny)
}
