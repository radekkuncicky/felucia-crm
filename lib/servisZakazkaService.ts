import { prisma } from './prisma'
import { orgPrisma } from './orgPrisma'
import { nextServisniZakazkaCislo } from './servisniZakazkaCislo'

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
}

export async function listServisniZakazky(orgId: string, filter: ListFilter = {}) {
  const db = orgPrisma(orgId)
  const { from, to, stav } = filter
  return db.servisniZakazka.findMany({
    where: {
      orgId,
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

  // Cizí ID jen v rámci org (ochrana proti IDOR napříč tenanty).
  if (input.zarizeniId && !(await db.zarizeni.findFirst({ where: { id: input.zarizeniId, orgId } }))) {
    return { ok: false, status: 400, error: 'Zařízení nebylo nalezeno' }
  }
  if (input.klientId && !(await db.client.findFirst({ where: { id: input.klientId, orgId } }))) {
    return { ok: false, status: 400, error: 'Klient nebyl nalezen' }
  }
  if (input.kontraktId && !(await db.servisniKontrakt.findFirst({ where: { id: input.kontraktId, orgId } }))) {
    return { ok: false, status: 400, error: 'Kontrakt nebyl nalezen' }
  }
  if (input.technikId && !(await db.user.findFirst({ where: { id: input.technikId, orgId } }))) {
    return { ok: false, status: 400, error: 'Technik nebyl nalezen v této organizaci' }
  }

  const stav = input.stav ?? (parsedTermin ? 'NAPLANOVANA' : 'NOVA')

  const created = await prisma.$transaction(async (tx) => {
    const cislo = await nextServisniZakazkaCislo(tx, orgId)
    return tx.servisniZakazka.create({
      data: {
        orgId,
        cislo,
        typ: (input.typ as never) || 'PLANOVANY_SERVIS',
        stav: stav as never,
        planovanyTermin: parsedTermin,
        technikId: input.technikId || null,
        poznamka: input.poznamka || null,
        kontraktId: input.kontraktId || null,
        zarizeniId: input.zarizeniId || null,
        klientId: input.klientId || null,
      },
      include: ZAKAZKA_INCLUDE,
    })
  })

  return { ok: true, data: created }
}

export type UpdateInput = Record<string, unknown>

// Úprava servisní zakázky (stav, výsledek práce, náklady, termíny, cekaDuvod...).
// stav už musí být nový enum (volající přemapuje legacy přes shim).
export async function updateServisniZakazka(
  orgId: string,
  id: string,
  body: UpdateInput,
): Promise<ServiceResult<{ id: string }>> {
  const db = orgPrisma(orgId)
  const z = await db.servisniZakazka.findFirst({ where: { id, orgId } })
  if (!z) return { ok: false, status: 404, error: 'Not found' }

  if (body.technikId) {
    const technik = await db.user.findFirst({ where: { id: body.technikId as string, orgId } })
    if (!technik) return { ok: false, status: 400, error: 'Technik nenalezen' }
  }

  const has = (k: string) => body[k] !== undefined

  const updated = await db.servisniZakazka.update({
    where: { id },
    data: {
      stav: has('stav') ? (body.stav as never) : z.stav,
      typ: has('typ') ? (body.typ as never) : z.typ,
      technikId: has('technikId') ? ((body.technikId as string) || null) : z.technikId,
      poznamka: has('poznamka') ? (body.poznamka as string | null) : z.poznamka,
      zprava: has('zprava') ? (body.zprava as string | null) : z.zprava,
      nalezeneZavady: has('nalezeneZavady') ? (body.nalezeneZavady as string | null) : z.nalezeneZavady,
      doporuceni: has('doporuceni') ? (body.doporuceni as string | null) : z.doporuceni,
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
    },
    include: ZAKAZKA_INCLUDE,
  })

  return { ok: true, data: updated }
}
