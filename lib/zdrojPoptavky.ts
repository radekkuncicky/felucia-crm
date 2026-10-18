/**
 * Zdroj poptávky — odkud o nás zákazník ví (KPI 6/7, docs/kpi-vedeni R11).
 * Číselník je per org; výchozí položky se založí při prvním čtení, takže
 * nová org nic nenastavuje. Zdroj se drží na leadu i na OP (většina OP
 * vzniká bez leadu) a při převodu leadu se zkopíruje na OP.
 */
import type { OrgPrismaClient } from './orgPrisma'

export const ZDROJ_GOOGLE_ADS = 'GOOGLE_ADS'
export const ZDROJ_DOPORUCENI = 'DOPORUCENI'

export const VYCHOZI_ZDROJE = [
  { kod: ZDROJ_DOPORUCENI, nazev: 'Doporučení' },
  { kod: ZDROJ_GOOGLE_ADS, nazev: 'Google Ads' },
  { kod: 'WEB_ORGANICKY', nazev: 'Web (vyhledávání)' },
  { kod: 'OPAKOVANY', nazev: 'Opakovaný zákazník' },
  { kod: 'PARTNER', nazev: 'Partner' },
  { kod: 'OSTATNI', nazev: 'Ostatní' },
] as const

export interface ZdrojPoptavkyVolba {
  id: string
  kod: string
  nazev: string
  aktivni: boolean
}

/** Číselník org (včetně neaktivních kvůli zobrazení historie); chybí-li, založí výchozí. */
export async function nactiZdroje(db: OrgPrismaClient, orgId: string): Promise<ZdrojPoptavkyVolba[]> {
  const select = { id: true, kod: true, nazev: true, aktivni: true }
  const rows = await db.zdrojPoptavky.findMany({ where: { orgId }, select, orderBy: { poradi: 'asc' } })
  if (rows.length) return rows
  await db.zdrojPoptavky.createMany({
    data: VYCHOZI_ZDROJE.map((z, i) => ({ orgId, kod: z.kod, nazev: z.nazev, poradi: i + 1 })),
    skipDuplicates: true,
  })
  return db.zdrojPoptavky.findMany({ where: { orgId }, select, orderBy: { poradi: 'asc' } })
}

export async function zdrojIdPodleKodu(db: OrgPrismaClient, orgId: string, kod: string): Promise<string | null> {
  const zdroje = await nactiZdroje(db, orgId)
  return zdroje.find(z => z.kod === kod)?.id ?? null
}

export interface ZdrojVstup {
  zdrojPoptavkyId: string | null
  doporucilKlientId: string | null
  doporucilText: string | null
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/**
 * Zdroj z těla požadavku → data pro lead/OP, nebo text chyby.
 * Klíče, které v těle nejsou, se nevrací (PATCH je nemění). „Kdo doporučil“
 * dává smysl jen u doporučení — u jiného zdroje se smaže.
 */
export async function parseZdroj(
  db: OrgPrismaClient,
  orgId: string,
  body: Record<string, unknown>,
): Promise<Partial<ZdrojVstup> | string> {
  if (!('zdrojPoptavkyId' in body) && !('doporucilKlientId' in body) && !('doporucilText' in body)) return {}
  const out: Partial<ZdrojVstup> = {}
  let kod: string | null | undefined
  if ('zdrojPoptavkyId' in body) {
    const id = str(body.zdrojPoptavkyId)
    if (id) {
      const z = await db.zdrojPoptavky.findFirst({ where: { id, orgId }, select: { kod: true } })
      if (!z) return 'Neplatný zdroj poptávky'
      kod = z.kod
    } else {
      kod = null
    }
    out.zdrojPoptavkyId = id
  }
  if ('doporucilKlientId' in body) {
    const id = str(body.doporucilKlientId)
    if (id && !(await db.client.findFirst({ where: { id, orgId }, select: { id: true } }))) return 'Doporučující klient nenalezen'
    out.doporucilKlientId = id
  }
  if ('doporucilText' in body) out.doporucilText = str(body.doporucilText)?.slice(0, 200) ?? null
  if (kod !== undefined && kod !== ZDROJ_DOPORUCENI) {
    out.doporucilKlientId = null
    out.doporucilText = null
  }
  return out
}

/**
 * Lead z webového formuláře: Google Ads poznáme jen podle stop kliknutí
 * (gclid/gbraid/wbraid nebo utm_source=google + placené medium) v adrese
 * stránky nebo v meta z formuláře. Jinak zdroj zůstane prázdný (Q20).
 */
export function jeZGoogleAds(...vstupy: (string | null | undefined | Record<string, unknown>)[]): boolean {
  for (const v of vstupy) {
    if (!v) continue
    const params = new Map<string, string>()
    if (typeof v === 'string') {
      try {
        new URL(v, 'https://x.invalid').searchParams.forEach((val, key) => params.set(key.toLowerCase(), val.toLowerCase()))
      } catch { continue }
    } else {
      for (const [key, val] of Object.entries(v)) {
        if (typeof val === 'string' && val.trim()) params.set(key.toLowerCase(), val.trim().toLowerCase())
      }
    }
    if (params.get('gclid') || params.get('gbraid') || params.get('wbraid')) return true
    const source = params.get('utm_source')
    const medium = params.get('utm_medium') ?? ''
    if (source && /google|adwords/.test(source) && /cpc|ppc|paid|ads/.test(medium)) return true
  }
  return false
}
