import { createHmac, timingSafeEqual } from 'crypto'
import type { Prisma } from '@prisma/client'
import { resolvePermissions } from '@/lib/permissions'

/**
 * Výkaz práce techniků — hodiny + km (VYJEZD) a vlastní položky (POLOZKA: materiál, odměna…)
 * k zakázce nebo servisnímu výjezdu. Technik (OSVČ) si z nevyfakturovaných záznamů dělá
 * podklad k faktuře firmě; „Vyfakturováno“ je uzavře do VykazFakturace.
 * Sazby jsou technikova odměna = náklad firmy (ne prodejní cena). Nastavuje je firma na webu
 * (Nastavení → Uživatelé); technik je v appce jen vidí. Zápis bez sazby projde („čeká na sazbu“),
 * sazba se do otevřených záznamů doplní, až ji firma nastaví — uzavřít výkaz jde až pak.
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

/** Výjezd s hodinami/km, ke kterým zatím není sazba (firma ji ještě nenastavila) */
export function chybiSazbaZaznamu(z: VykazRadekDb): boolean {
  if (z.typ === 'POLOZKA') return false
  return (num(z.hodiny) > 0 && z.sazbaHodina == null) || (z.km > 0 && z.sazbaKm == null)
}

/** Částka jednoho záznamu v Kč (chybějící sazba = ta část se zatím nepočítá) */
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
  /** počet výjezdů, kterým chybí sazba (částka je pak neúplná) */
  chybiSazba: number
}

export function souctyVykazu(zaznamy: VykazRadekDb[]): VykazSoucty {
  const s: VykazSoucty = { hodiny: 0, km: 0, castkaHodiny: 0, castkaKm: 0, castkaPolozky: 0, castka: 0, pocet: zaznamy.length, chybiSazba: 0 }
  for (const z of zaznamy) {
    if (chybiSazbaZaznamu(z)) s.chybiSazba++
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
    chybiSazba: chybiSazbaZaznamu(z),
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

// ── Sazby technika (nastavuje firma) ─────────────────────────────────────────

type SazbyDb = {
  vykazPrace: { updateMany: (a: { where: Prisma.VykazPraceWhereInput; data: Prisma.VykazPraceUpdateManyMutationInput }) => Promise<{ count: number }> }
}

/**
 * Po nastavení sazby firmou doplní sazbu do OTEVŘENÝCH výjezdů technika, které ji zatím nemají.
 * Už nasnapshotovaná sazba ani uzavřené záznamy se nemění.
 */
export async function doplnSazbyOtevrenym(
  db: SazbyDb, orgId: string, userId: string, sazby: { sazbaHodina?: number | null; sazbaKm?: number | null },
): Promise<number> {
  let n = 0
  const base = { orgId, userId, typ: 'VYJEZD' as const, fakturaceId: null }
  if (sazby.sazbaHodina != null) {
    n += (await db.vykazPrace.updateMany({ where: { ...base, sazbaHodina: null }, data: { sazbaHodina: sazby.sazbaHodina } })).count
  }
  if (sazby.sazbaKm != null) {
    n += (await db.vykazPrace.updateMany({ where: { ...base, sazbaKm: null }, data: { sazbaKm: sazby.sazbaKm } })).count
  }
  return n
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
  zaznamy: { id: string; typ: 'VYJEZD' | 'POLOZKA'; datum: Date; hodiny: number; km: number; popis: string | null; poznamka: string | null; castka: number; chybiSazba: boolean; vyfakturovano: boolean }[]
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
          popis: z.popis, poznamka: z.poznamka, castka: castkaZaznamu(z), chybiSazba: chybiSazbaZaznamu(z), vyfakturovano: !!z.fakturaceId,
        })),
      }
    })
    .sort((a, b) => b.soucty.castka - a.soucty.castka || b.soucty.hodiny - a.soucty.hodiny)
}

// ── Kdo ve firmě vidí výkazy (náklady) ───────────────────────────────────────

type UserPermsDb = { id: string; role: string; permissions: unknown }

/** Aktivní uživatelé s přístupem k nákladům (financeNakupky) — dostávají info o uzavřených výkazech */
export function prijemciVykazu(users: UserPermsDb[], plan: string, krome?: string): string[] {
  return users
    .filter(u => u.id !== krome && resolvePermissions(u.role, u.permissions, plan).financeNakupky)
    .map(u => u.id)
}

const fmtCislo = (n: number, d = 2) => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: d }).format(n)

/** Text bell notifikace o uzavření výkazu */
export function zpravaUzavreni(jmeno: string, cislo: number, s: { hodiny: number; km: number; castka: number }): string {
  return `${jmeno} uzavřel(a) výkaz práce č. ${cislo} · ${fmtCislo(s.hodiny)} h · ${fmtCislo(s.km, 0)} km · ${fmtCislo(s.castka, 0)} Kč`
}

// ── Přehled pro vedení (/vykazy) ─────────────────────────────────────────────

export type PrehledZaznam = {
  id: string; typ: 'VYJEZD' | 'POLOZKA'; datum: string; hodiny: number; km: number
  popis: string | null; poznamka: string | null; castka: number; chybiSazba: boolean
  zakazka: { druh: 'ZAKAZKA' | 'SERVIS'; id: string; cislo: string; nazev: string }
}

export type PrehledTechnik = {
  userId: string
  jmeno: string
  aktivni: boolean
  sazbaHodina: number | null
  sazbaKm: number | null
  otevreno: VykazSoucty
  otevrenoOd: string | null
  zaznamy: PrehledZaznam[]
  posledni: { cislo: number; obdobiDo: string; vytvoreno: string; castka: number } | null
}

type PrehledUserDb = { id: string; jmeno: string; aktivni: boolean; sazbaHodina: Num; sazbaKm: Num }
type PrehledFakturaceDb = { userId: string; cislo: number; obdobiDo: Date; vytvoreno: Date; castkaCelkem: Num }

/**
 * Technici s otevřenými (nevyfakturovanými) záznamy a sazbami. `users` = technici, které chceme vidět
 * i bez záznamů (kvůli nastavení sazeb); autor otevřeného záznamu se přidá vždy.
 * Řazení: kdo má otevřeno víc Kč nahoře, pak podle jména.
 */
export function prehledTechniku(
  users: PrehledUserDb[],
  otevrene: (VykazSInclude & { user: PrehledUserDb })[],
  fakturace: PrehledFakturaceDb[],
): PrehledTechnik[] {
  const map = new Map<string, { user: PrehledUserDb; zz: (VykazSInclude & { user: PrehledUserDb })[] }>()
  for (const u of users) map.set(u.id, { user: u, zz: [] })
  for (const z of otevrene) {
    const e = map.get(z.userId) ?? { user: z.user, zz: [] }
    e.zz.push(z)
    map.set(z.userId, e)
  }
  const posledni = new Map<string, PrehledFakturaceDb>()
  for (const f of fakturace) {
    const p = posledni.get(f.userId)
    if (!p || f.cislo > p.cislo) posledni.set(f.userId, f)
  }
  return Array.from(map.values())
    .map(({ user, zz }) => {
      const serazene = [...zz].sort((a, b) => a.datum.getTime() - b.datum.getTime())
      const p = posledni.get(user.id)
      return {
        userId: user.id,
        jmeno: user.jmeno,
        aktivni: user.aktivni,
        sazbaHodina: user.sazbaHodina == null ? null : num(user.sazbaHodina),
        sazbaKm: user.sazbaKm == null ? null : num(user.sazbaKm),
        otevreno: souctyVykazu(serazene),
        otevrenoOd: serazene[0] ? serazene[0].datum.toISOString().slice(0, 10) : null,
        zaznamy: serazene.map(z => ({
          id: z.id, typ: z.typ, datum: z.datum.toISOString().slice(0, 10), hodiny: num(z.hodiny), km: z.km,
          popis: z.popis, poznamka: z.poznamka, castka: castkaZaznamu(z), chybiSazba: chybiSazbaZaznamu(z),
          zakazka: zakazkaZaznamu(z),
        })),
        posledni: p ? {
          cislo: p.cislo, obdobiDo: p.obdobiDo.toISOString().slice(0, 10),
          vytvoreno: p.vytvoreno.toISOString(), castka: num(p.castkaCelkem),
        } : null,
      }
    })
    .filter(t => t.aktivni || t.zaznamy.length > 0)
    .sort((a, b) => b.otevreno.castka - a.otevreno.castka || b.otevreno.hodiny - a.otevreno.hodiny || a.jmeno.localeCompare(b.jmeno, 'cs'))
}

// ── Přehled práce za období (/vykazy, tabulka „Kdo kolik fakturoval“) ─────────

export type PraceZakazka = {
  zakazka: { druh: 'ZAKAZKA' | 'SERVIS'; id: string; cislo: string; nazev: string }
  soucty: VykazSoucty
  zaznamy: (PrehledZaznam & { vyfakturovano: boolean })[]
}

export type PraceTechnik = {
  userId: string
  jmeno: string
  soucty: VykazSoucty
  /** část, kterou technik už uzavřel do výkazu (= fakturoval firmě) */
  uzavreno: number
  zakazky: PraceZakazka[]
}

type PraceDb = VykazSInclude & { user: { jmeno: string } }

/**
 * Záznamy za období (otevřené i uzavřené) → technik → zakázka → záznamy.
 * Řazení: technici i zakázky podle částky (pak hodin), záznamy podle data.
 */
export function prehledPrace(zaznamy: PraceDb[]): PraceTechnik[] {
  const technici = new Map<string, { jmeno: string; zakazky: Map<string, PraceDb[]> }>()
  for (const z of zaznamy) {
    const t = technici.get(z.userId) ?? { jmeno: z.user.jmeno, zakazky: new Map() }
    technici.set(z.userId, t)
    const key = z.zakazkaId ?? `s:${z.servisniZakazkaId}`
    t.zakazky.set(key, [...(t.zakazky.get(key) ?? []), z])
  }
  const podleCastky = (a: { soucty: VykazSoucty }, b: { soucty: VykazSoucty }) =>
    b.soucty.castka - a.soucty.castka || b.soucty.hodiny - a.soucty.hodiny
  return Array.from(technici.entries())
    .map(([userId, t]) => {
      const vse = Array.from(t.zakazky.values()).flat()
      return {
        userId,
        jmeno: t.jmeno,
        soucty: souctyVykazu(vse),
        uzavreno: souctyVykazu(vse.filter(z => z.fakturaceId)).castka,
        zakazky: Array.from(t.zakazky.values())
          .map(zz => ({
            zakazka: zakazkaZaznamu(zz[0]),
            soucty: souctyVykazu(zz),
            zaznamy: [...zz]
              .sort((a, b) => a.datum.getTime() - b.datum.getTime())
              .map(z => ({
                id: z.id, typ: z.typ, datum: z.datum.toISOString().slice(0, 10), hodiny: num(z.hodiny), km: z.km,
                popis: z.popis, poznamka: z.poznamka, castka: castkaZaznamu(z), chybiSazba: chybiSazbaZaznamu(z),
                zakazka: zakazkaZaznamu(z), vyfakturovano: !!z.fakturaceId,
              })),
          }))
          .sort(podleCastky),
      }
    })
    .sort((a, b) => podleCastky(a, b) || a.jmeno.localeCompare(b.jmeno, 'cs'))
}
