/**
 * „Dnes" pro technika na nástěnce: montáže zakázek a etap, do jejichž rozsahu
 * dnešek padá, + servisní zásahy naplánované na dnešek. Rozsah podle oprávnění
 * (zakazkyScopeWhere / servisScopeWhere). Viz docs/ux-audit/NAVRH.md A1.
 */
import type { OrgPrismaClient } from './orgPrisma'
import { zakazkyScopeWhere, servisScopeWhere, type Permissions } from './permissions'
import { getPlanLimits } from './planLimits'
import { klientAdresa } from './mobile-helpers'
import { typLabel } from './servisStav'

const TZ = 'Europe/Prague'

export interface Vyjezd {
  typ: 'montaz' | 'servis'
  id: string
  href: string
  /** Čas zásahu HH:MM (jen servis s časem), montáže jsou celodenní */
  cas: string | null
  titulek: string
  cislo: string
  klient: string
  telefon: string | null
  adresa: string
}

/** Dnešní den v Praze jako YYYY-MM-DD */
export function dnesPraha(now = new Date()): string {
  // eslint-disable-next-line no-restricted-syntax -- výpočet pražského dne/času, ne formátování pro UI
  return now.toLocaleDateString('sv-SE', { timeZone: TZ })
}

/** Posun pražského času vůči UTC v ms pro daný okamžik (CET/CEST) */
function pragueOffsetMs(at: Date): number {
  // eslint-disable-next-line no-restricted-syntax -- výpočet pražského dne/času, ne formátování pro UI
  const praha = new Date(at.toLocaleString('en-US', { timeZone: TZ }))
  // eslint-disable-next-line no-restricted-syntax -- výpočet pražského dne/času, ne formátování pro UI
  const utc = new Date(at.toLocaleString('en-US', { timeZone: 'UTC' }))
  return praha.getTime() - utc.getTime()
}

/**
 * Okno dneška: montáže mají termín jako UTC půlnoc dne (lib/calendarEvents.ts) → denOd/denDo,
 * servis má skutečný čas → pražský den servisOd/servisDo. `vRozsahu` = dnešek padá do montazOd–montazDo
 * (bez „do“ jen den začátku). Sdílí nástěnka, mobilní Dnes i Konec dne.
 */
export function denniOkno(now = new Date()) {
  const denOd = new Date(`${dnesPraha(now)}T00:00:00Z`)
  const denDo = new Date(denOd.getTime() + 86_400_000)
  const servisOd = new Date(denOd.getTime() - pragueOffsetMs(now))
  const servisDo = new Date(servisOd.getTime() + 86_400_000)
  const vRozsahu = {
    montazOd: { lt: denDo },
    OR: [{ montazDo: { gte: denOd } }, { montazDo: null, montazOd: { gte: denOd } }],
  }
  return { denOd, denDo, servisOd, servisDo, vRozsahu }
}

export async function dnesniVyjezdy(
  db: OrgPrismaClient,
  opts: {
    orgId: string; userId: string; perms: Permissions; plan?: string | null; modulServis?: boolean; now?: Date
    /** I dnes dokončené (zakázka HOTOVO, servis CEKA/DOKONCENA) — pro zápis výkazu na konci dne */
    vcetneDokoncenych?: boolean
  },
): Promise<Vyjezd[]> {
  const now = opts.now ?? new Date()
  const { servisOd, servisDo, vRozsahu } = denniOkno(now)

  const zakazkyScope = zakazkyScopeWhere(opts.perms, opts.userId)
  const servisScope = getPlanLimits(opts.plan ?? 'STARTER').hasServiceModule && opts.modulServis
    ? servisScopeWhere(opts.perms, opts.userId)
    : null

  const [zakazky, servis] = await Promise.all([
    !zakazkyScope ? [] : db.zakazka.findMany({
      where: {
        orgId: opts.orgId,
        AND: [zakazkyScope, { OR: [vRozsahu, { etapy: { some: vRozsahu } }] }],
        ...(opts.vcetneDokoncenych ? {} : { stav: { notIn: ['HOTOVO'] } }),
      },
      select: {
        id: true, cislo: true, nazev: true, mistoStavby: true,
        klient: { select: { jmeno: true, prijmeni: true, telefon: true, ulice: true, mesto: true, psc: true } },
      },
      orderBy: { cislo: 'asc' },
      take: 20,
    }),
    !servisScope ? [] : db.servisniZakazka.findMany({
      where: {
        orgId: opts.orgId,
        AND: [servisScope],
        stav: { in: opts.vcetneDokoncenych ? ['NAPLANOVANA', 'PROBIHA', 'CEKA', 'DOKONCENA'] : ['NAPLANOVANA', 'PROBIHA'] },
        planovanyTermin: { gte: servisOd, lt: servisDo },
      },
      select: {
        id: true, cislo: true, typ: true, popis: true, adresaZasahu: true, planovanyTermin: true,
        klient: { select: { jmeno: true, prijmeni: true, telefon: true, ulice: true, mesto: true, psc: true } },
        kontrakt: { select: { klient: { select: { jmeno: true, prijmeni: true, telefon: true, ulice: true, mesto: true, psc: true } } } },
      },
      orderBy: { planovanyTermin: 'asc' },
      take: 20,
    }),
  ])

  const casPraha = (d: Date) => {
    // eslint-disable-next-line no-restricted-syntax -- výpočet pražského dne/času, ne formátování pro UI
    const cas = d.toLocaleTimeString('cs-CZ', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
    return cas === '00:00' ? null : cas
  }

  return [
    ...servis.map(s => {
      const k = s.klient ?? s.kontrakt?.klient ?? null
      return {
        typ: 'servis' as const,
        id: s.id,
        href: `/servis/zakazky/${s.id}`,
        cas: s.planovanyTermin ? casPraha(s.planovanyTermin) : null,
        titulek: s.popis || typLabel(s.typ),
        cislo: s.cislo ?? '',
        klient: k ? `${k.jmeno} ${k.prijmeni}`.trim() : '',
        telefon: k?.telefon ?? null,
        adresa: s.adresaZasahu || (k ? klientAdresa(k) : ''),
      }
    }),
    ...zakazky.map(z => ({
      typ: 'montaz' as const,
      id: z.id,
      href: `/zakazky/${z.id}`,
      cas: null,
      titulek: z.nazev,
      cislo: z.cislo,
      klient: `${z.klient.jmeno} ${z.klient.prijmeni}`.trim(),
      telefon: z.klient.telefon,
      adresa: z.mistoStavby || klientAdresa(z.klient),
    })),
  ]
}
