import { prisma } from './prisma'
import { orgPrisma } from './orgPrisma'
import { nextServisniZakazkaCislo } from './servisniZakazkaCislo'
import { jePovolenyPrechod, stavLabel } from './servisStav'
import { signZarizeniQrToken } from './zarizeniQr'

const ZAKAZKA_INCLUDE = {
  kontrakt: {
    select: {
      id: true,
      nazev: true,
      klient: { select: { id: true, jmeno: true, prijmeni: true } },
    },
  },
  zarizeni: { select: { id: true, nazev: true, typ: true } },
  technik: { select: { id: true, jmeno: true } },
} as const

export type ListFilter = {
  from?: string | null
  to?: string | null
  stav?: string | null // už namapováno na nový enum (volající si poradí se shimem)
  /** rozsah uživatele (servisScopeWhere) — `{}` = vše */
  scope?: Record<string, unknown>
}

export async function listServisniZakazky(orgId: string, filter: ListFilter = {}) {
  const db = orgPrisma(orgId)
  const { from, to, stav, scope } = filter
  return db.servisniZakazka.findMany({
    where: {
      orgId,
      ...(scope ?? {}),
      ...(from || to
        ? {
            planovanyTermin: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(stav ? { stav: stav as never } : {}),
    },
    include: ZAKAZKA_INCLUDE,
    orderBy: { planovanyTermin: 'asc' },
  })
}

export type CreateInput = {
  planovanyTermin?: string | null
  technikId?: string | null
  poznamka?: string | null
  typ?: string | null
  zarizeniId?: string | null
  klientId?: string | null
  kontraktId?: string | null
  stav?: string | null
  // Zadání akce (servis/nova — klient z ulice)
  popis?: string | null
  priorita?: string | null
  adresaZasahu?: string | null
  kontaktJmeno?: string | null
  kontaktTelefon?: string | null
  /** Nové zařízení klienta založené spolu se zakázkou (výlučné se zarizeniId). */
  noveZarizeni?: { nazev: string; typ?: string | null; vyrobniCislo?: string | null } | null
}

const PRIORITY = ['BEZNA', 'URGENTNI'] as const

// Adresa klienta jako jeden řádek (fallback pro adresaZasahu).
export function formatKlientAdresa(k: { ulice?: string | null; mesto?: string | null; psc?: string | null } | null | undefined) {
  if (!k) return null
  const radek2 = [k.psc, k.mesto].filter(Boolean).join(' ')
  const adresa = [k.ulice, radek2].filter(Boolean).join(', ')
  return adresa || null
}

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }

// Založení servisní zakázky. Stav: explicitní > podle termínu (NAPLANOVANA)
// > NOVA (reaktivní bez termínu). Číslo + insert v jedné transakci.
export async function createServisniZakazka(
  orgId: string,
  input: CreateInput,
): Promise<ServiceResult<{ id: string }>> {
  const db = orgPrisma(orgId)

  let parsedTermin: Date | null = null
  if (input.planovanyTermin) {
    parsedTermin = new Date(input.planovanyTermin)
    if (isNaN(parsedTermin.getTime())) {
      return { ok: false, status: 400, error: 'Neplatný formát data planovanyTermin' }
    }
  }

  if (input.priorita && !PRIORITY.includes(input.priorita as never)) {
    return { ok: false, status: 400, error: 'Neplatná priorita' }
  }
  if (input.noveZarizeni && input.zarizeniId) {
    return { ok: false, status: 400, error: 'Zadej buď existující zařízení, nebo nové — ne obě' }
  }
  if (input.noveZarizeni && !input.noveZarizeni.nazev?.trim()) {
    return { ok: false, status: 400, error: 'Nové zařízení musí mít název' }
  }

  // Cizí ID jen v rámci org (ochrana proti IDOR napříč tenanty).
  const zarizeni = input.zarizeniId
    ? await db.zarizeni.findFirst({
        where: { id: input.zarizeniId, orgId },
        select: {
          id: true,
          klientId: true,
          servisniKontrakty: { where: { aktivni: true }, select: { id: true }, take: 1 },
        },
      })
    : null
  if (input.zarizeniId && !zarizeni) {
    return { ok: false, status: 400, error: 'Zařízení nebylo nalezeno' }
  }
  // Zařízení určuje klienta (zakázka bez klienta u zařízení nedává smysl).
  const klientId = input.klientId || zarizeni?.klientId || null
  const klient = klientId
    ? await db.client.findFirst({ where: { id: klientId, orgId }, select: { id: true, ulice: true, mesto: true, psc: true } })
    : null
  if (klientId && !klient) {
    return { ok: false, status: 400, error: 'Klient nebyl nalezen' }
  }
  if (input.noveZarizeni && !klient) {
    return { ok: false, status: 400, error: 'Nové zařízení potřebuje klienta' }
  }
  if (input.kontraktId && !(await db.servisniKontrakt.findFirst({ where: { id: input.kontraktId, orgId } }))) {
    return { ok: false, status: 400, error: 'Kontrakt nebyl nalezen' }
  }
  if (input.technikId && !(await db.user.findFirst({ where: { id: input.technikId, orgId } }))) {
    return { ok: false, status: 400, error: 'Technik nebyl nalezen v této organizaci' }
  }

  const stav = input.stav ?? (parsedTermin ? 'NAPLANOVANA' : 'NOVA')
  // Kontrakt: explicitní > aktivní kontrakt vybraného zařízení (dřív dopočítával klient v modalu).
  const kontraktId = input.kontraktId || zarizeni?.servisniKontrakty[0]?.id || null
  // Místo zásahu: explicitní > adresa klienta (aby ho měl i mobil bez skládání).
  const adresaZasahu = input.adresaZasahu?.trim() || formatKlientAdresa(klient)

  const created = await prisma.$transaction(async (tx) => {
    let zarizeniId = input.zarizeniId || null
    if (input.noveZarizeni && klient) {
      const nove = await tx.zarizeni.create({
        data: {
          orgId,
          klientId: klient.id,
          nazev: input.noveZarizeni.nazev.trim(),
          typ: (input.noveZarizeni.typ as never) || 'JINE',
          vyrobniCislo: input.noveZarizeni.vyrobniCislo?.trim() || null,
        },
        select: { id: true },
      })
      await tx.zarizeni.update({
        where: { id: nove.id },
        data: { qrToken: await signZarizeniQrToken(nove.id, orgId) },
      })
      zarizeniId = nove.id
    }

    const cislo = await nextServisniZakazkaCislo(tx, orgId)
    return tx.servisniZakazka.create({
      data: {
        orgId,
        cislo,
        typ: (input.typ as never) || 'PLANOVANY_SERVIS',
        stav: stav as never,
        priorita: (input.priorita as never) || 'BEZNA',
        popis: input.popis?.trim() || null,
        adresaZasahu,
        kontaktJmeno: input.kontaktJmeno?.trim() || null,
        kontaktTelefon: input.kontaktTelefon?.trim() || null,
        planovanyTermin: parsedTermin,
        technikId: input.technikId || null,
        poznamka: input.poznamka || null,
        kontraktId,
        zarizeniId,
        klientId,
      },
      include: ZAKAZKA_INCLUDE,
    })
  })

  return { ok: true, data: created }
}

export type UpdateInput = Record<string, unknown>

export type UpdateOptions = {
  // Dispečer escape hatch: ruční přepis stavu mimo povolené přechody.
  forceStav?: boolean
  /** rozsah uživatele (servisScopeWhere) — zakázka mimo rozsah = 404 */
  scope?: Record<string, unknown>
}

// Úprava servisní zakázky (stav, výsledek práce, náklady, termíny, cekaDuvod...).
// stav už musí být nový enum (volající přemapuje legacy přes shim).
export async function updateServisniZakazka(
  orgId: string,
  id: string,
  body: UpdateInput,
  opts: UpdateOptions = {},
): Promise<ServiceResult<{ id: string }>> {
  const db = orgPrisma(orgId)
  const z = await db.servisniZakazka.findFirst({ where: { id, orgId, ...(opts.scope ?? {}) } })
  if (!z) return { ok: false, status: 404, error: 'Not found' }

  if (body.technikId) {
    const technik = await db.user.findFirst({ where: { id: body.technikId as string, orgId } })
    if (!technik) return { ok: false, status: 400, error: 'Technik nenalezen' }
  }

  if (body.priorita !== undefined && !PRIORITY.includes(body.priorita as never)) {
    return { ok: false, status: 400, error: 'Neplatná priorita' }
  }

  if (body.zaplaceno === true && !['VYUCTOVANA', 'UZAVRENA'].includes(z.stav)) {
    return { ok: false, status: 422, error: 'Zakázku lze označit jako zaplacenou pouze po vyúčtování.' }
  }

  const has = (k: string) => body[k] !== undefined

  const novyStav = has('stav') ? (body.stav as string) : z.stav
  if (novyStav !== z.stav && !opts.forceStav && !jePovolenyPrechod(z.stav, novyStav)) {
    return {
      ok: false,
      status: 422,
      error: `Přechod ${stavLabel(z.stav)} → ${stavLabel(novyStav)} není povolen.`,
    }
  }

  // Dokončení protokolu je navázané na přechod do stavu DOKONCENA (brána do
  // vyúčtování). Nastaví se jednou, zpětně se nemaže.
  const protokolDokoncen =
    novyStav === 'DOKONCENA' && !z.protokolDokoncen ? new Date() : z.protokolDokoncen

  const updated = await db.servisniZakazka.update({
    where: { id },
    data: {
      stav: has('stav') ? (body.stav as never) : z.stav,
      protokolDokoncen,
      typ: has('typ') ? (body.typ as never) : z.typ,
      priorita: has('priorita') ? (body.priorita as never) : z.priorita,
      popis: has('popis') ? ((body.popis as string | null) || null) : z.popis,
      adresaZasahu: has('adresaZasahu') ? ((body.adresaZasahu as string | null) || null) : z.adresaZasahu,
      kontaktJmeno: has('kontaktJmeno') ? ((body.kontaktJmeno as string | null) || null) : z.kontaktJmeno,
      kontaktTelefon: has('kontaktTelefon') ? ((body.kontaktTelefon as string | null) || null) : z.kontaktTelefon,
      technikId: has('technikId') ? ((body.technikId as string) || null) : z.technikId,
      poznamka: has('poznamka') ? (body.poznamka as string | null) : z.poznamka,
      zprava: has('zprava') ? (body.zprava as string | null) : z.zprava,
      nalezeneZavady: has('nalezeneZavady') ? (body.nalezeneZavady as string | null) : z.nalezeneZavady,
      doporuceni: has('doporuceni') ? (body.doporuceni as string | null) : z.doporuceni,
      podpisKlienta: has('podpisKlienta') ? (body.podpisKlienta as string | null) : z.podpisKlienta,
      cekaDuvod: has('cekaDuvod') ? (body.cekaDuvod as string | null) : z.cekaDuvod,
      trvaniMinut: has('trvaniMinut') ? (body.trvaniMinut as number | null) : z.trvaniMinut,
      nakladyCas: has('nakladyCas') ? (body.nakladyCas as never) : z.nakladyCas,
      nakladyMaterial: has('nakladyMaterial') ? (body.nakladyMaterial as never) : z.nakladyMaterial,
      skutecnyTermin: has('skutecnyTermin')
        ? (body.skutecnyTermin ? new Date(body.skutecnyTermin as string) : null)
        : z.skutecnyTermin,
      // has() pattern: explicitní null vyprázdní termín (detail i drag-to-pool v dispečinku),
      // chybějící klíč zachová stávající (dřív null mlčky ignorováno = termín nešel smazat).
      planovanyTermin: has('planovanyTermin')
        ? (body.planovanyTermin ? new Date(body.planovanyTermin as string) : null)
        : z.planovanyTermin,
      // Označení zaplacení (vyfakturováno řeší samostatná brána vyuctovat()).
      zaplaceno: has('zaplaceno') ? Boolean(body.zaplaceno) : z.zaplaceno,
      zaplacenoDatum: has('zaplaceno')
        ? (body.zaplaceno ? (z.zaplacenoDatum ?? new Date()) : null)
        : z.zaplacenoDatum,
    },
    include: ZAKAZKA_INCLUDE,
  })

  // Dokončení kontraktní zakázky naplánuje další návštěvu (+interval). Jediné
  // místo dogenerace — funguje stejně z webu, mobilu i legacy aliasů. Selhání
  // nesmí shodit samotné dokončení.
  if (novyStav === 'DOKONCENA' && z.stav !== 'DOKONCENA' && z.kontraktId) {
    try {
      await naplanujDalsiNavstevu(orgId, updated)
    } catch (err) {
      console.error(`[servis] dogenerace návštěvy pro zakázku ${id} selhala:`, err)
    }
  }

  return { ok: true, data: updated }
}

// Po dokončení zakázky kryté aktivním kontraktem s intervalem naplánuje další
// návštěvu (skutečný/teď + interval), pokud už žádná otevřená (NOVA/NAPLANOVANA
// s termínem v budoucnu či bez termínu) pro kontrakt neexistuje a termín
// nepřesahuje konec kontraktu. Vrací založenou zakázku, nebo null.
export async function naplanujDalsiNavstevu(
  orgId: string,
  dokoncena: {
    id: string
    kontraktId: string | null
    zarizeniId: string | null
    klientId: string | null
    technikId: string | null
    skutecnyTermin: Date | null
  },
) {
  if (!dokoncena.kontraktId) return null
  const db = orgPrisma(orgId)

  const kontrakt = await db.servisniKontrakt.findFirst({
    where: { id: dokoncena.kontraktId, orgId, aktivni: true },
    select: { id: true, intervalMesicu: true, konec: true },
  })
  if (!kontrakt || kontrakt.intervalMesicu <= 0) return null

  const now = new Date()
  const otevrena = await db.servisniZakazka.findFirst({
    where: {
      orgId,
      kontraktId: kontrakt.id,
      id: { not: dokoncena.id },
      stav: { in: ['NOVA', 'NAPLANOVANA'] },
      OR: [{ planovanyTermin: null }, { planovanyTermin: { gte: now } }],
    },
    select: { id: true },
  })
  if (otevrena) return null

  const termin = new Date(dokoncena.skutecnyTermin ?? now)
  termin.setMonth(termin.getMonth() + kontrakt.intervalMesicu)
  if (kontrakt.konec && termin > kontrakt.konec) return null

  return prisma.$transaction(async (tx) => {
    const cislo = await nextServisniZakazkaCislo(tx, orgId)
    return tx.servisniZakazka.create({
      data: {
        orgId,
        cislo,
        typ: 'PLANOVANY_SERVIS',
        stav: 'NAPLANOVANA',
        planovanyTermin: termin,
        kontraktId: kontrakt.id,
        zarizeniId: dokoncena.zarizeniId,
        klientId: dokoncena.klientId,
        technikId: dokoncena.technikId,
      },
    })
  })
}

// Reklamace = nová zakázka navázaná na původní (puvodniZakazkaId), stav NOVA
// bez termínu — objeví se dispečinku v poolu nezaplánovaných. Původní zakázka
// zůstává netknutá (historie i vyúčtování).
export async function createReklamace(
  orgId: string,
  puvodniId: string,
  input: { poznamka?: string | null; typ?: string | null } = {},
): Promise<ServiceResult<{ id: string }>> {
  const db = orgPrisma(orgId)
  const puvodni = await db.servisniZakazka.findFirst({ where: { id: puvodniId, orgId } })
  if (!puvodni) return { ok: false, status: 404, error: 'Not found' }

  if (!['DOKONCENA', 'VYUCTOVANA', 'UZAVRENA'].includes(puvodni.stav)) {
    return { ok: false, status: 422, error: 'Reklamovat lze jen dokončenou zakázku.' }
  }

  const created = await prisma.$transaction(async (tx) => {
    const cislo = await nextServisniZakazkaCislo(tx, orgId)
    return tx.servisniZakazka.create({
      data: {
        orgId,
        cislo,
        typ: (input.typ as never) || 'ZARUCNI_OPRAVA',
        stav: 'NOVA',
        puvodniZakazkaId: puvodni.id,
        kontraktId: puvodni.kontraktId,
        zarizeniId: puvodni.zarizeniId,
        klientId: puvodni.klientId,
        technikId: puvodni.technikId,
        poznamka: input.poznamka || `Reklamace k ${puvodni.cislo ?? 'zakázce'}`,
      },
      include: ZAKAZKA_INCLUDE,
    })
  })

  return { ok: true, data: created }
}
