import { prisma } from './prisma'
import { orgPrisma } from './orgPrisma'
import type { ServiceResult } from './servisZakazkaService'

// Vyúčtování servisní zakázky přes child tabulku ServisniPolozka.
// Položky kryté kontraktem se klientovi neúčtují (vstup do součtu = 0),
// ale zůstávají viditelné na podkladu. DPH default 12 % (řešeno na položce).

const POLOZKA_TYPY = ['PRACE', 'MATERIAL', 'DOPRAVA', 'JINE'] as const
type PolozkaTyp = (typeof POLOZKA_TYPY)[number]

export type PolozkaInput = {
  typ?: string | null
  popis?: string | null
  mnozstvi?: number | string | null
  jednotka?: string | null
  cenaZaJednotku?: number | string | null
  krytoKontraktem?: boolean | null
  dphSazba?: number | string | null
}

export type PolozkaRadek = {
  typ: PolozkaTyp
  popis: string
  mnozstvi: number
  jednotka: string
  cenaZaJednotku: number
  krytoKontraktem: boolean
  dphSazba: number
  // dopočtené
  zakladRadku: number // klientovi účtovaný základ (0 pokud kryto)
  dphRadku: number
  celkemRadku: number
}

export type VyuctovaniSouhrn = {
  polozky: PolozkaRadek[]
  zakladBezDph: number
  dphCelkem: number
  celkemSDph: number
  krytoKontraktem: boolean // alespoň jedna položka kryta
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const toNum = (v: unknown, fallback = 0): number => {
  if (v === null || v === undefined || v === '') return fallback
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v)
  return Number.isFinite(n) ? n : fallback
}

// Čistý výpočet — sdílí API i PDF podklad faktury.
export function computeVyuctovani(
  raw: Array<{
    typ: unknown
    popis: unknown
    mnozstvi: unknown
    jednotka: unknown
    cenaZaJednotku: unknown
    krytoKontraktem: unknown
    dphSazba: unknown
  }>,
): VyuctovaniSouhrn {
  let zakladBezDph = 0
  let dphCelkem = 0
  let kryto = false

  const polozky: PolozkaRadek[] = raw.map((p) => {
    const mnozstvi = toNum(p.mnozstvi, 0)
    const cena = toNum(p.cenaZaJednotku, 0)
    const dphSazba = toNum(p.dphSazba, 12)
    const krytoKontraktem = Boolean(p.krytoKontraktem)
    if (krytoKontraktem) kryto = true

    const zakladRadku = krytoKontraktem ? 0 : round2(mnozstvi * cena)
    const dphRadku = round2(zakladRadku * (dphSazba / 100))
    const celkemRadku = round2(zakladRadku + dphRadku)

    zakladBezDph += zakladRadku
    dphCelkem += dphRadku

    return {
      typ: (POLOZKA_TYPY.includes(p.typ as PolozkaTyp) ? p.typ : 'JINE') as PolozkaTyp,
      popis: String(p.popis ?? ''),
      mnozstvi,
      jednotka: String(p.jednotka ?? 'ks'),
      cenaZaJednotku: cena,
      krytoKontraktem,
      dphSazba,
      zakladRadku,
      dphRadku,
      celkemRadku,
    }
  })

  return {
    polozky,
    zakladBezDph: round2(zakladBezDph),
    dphCelkem: round2(dphCelkem),
    celkemSDph: round2(zakladBezDph + dphCelkem),
    krytoKontraktem: kryto,
  }
}

async function loadZakazka(orgId: string, zakazkaId: string) {
  return orgPrisma(orgId).servisniZakazka.findFirst({ where: { id: zakazkaId, orgId } })
}

export async function listPolozky(
  orgId: string,
  zakazkaId: string,
): Promise<ServiceResult<{ polozky: unknown[]; souhrn: VyuctovaniSouhrn }>> {
  const db = orgPrisma(orgId)
  if (!(await loadZakazka(orgId, zakazkaId))) return { ok: false, status: 404, error: 'Zakázka nenalezena' }
  const polozky = await db.servisniPolozka.findMany({
    where: { servisniZakazkaId: zakazkaId, orgId },
    orderBy: { poradi: 'asc' },
  })
  return { ok: true, data: { polozky, souhrn: computeVyuctovani(polozky as never) } }
}

// Nahradí celý seznam položek (jednoduchý editor: smaž + vlož v transakci).
export async function replacePolozky(
  orgId: string,
  zakazkaId: string,
  items: PolozkaInput[],
): Promise<ServiceResult<{ polozky: unknown[]; souhrn: VyuctovaniSouhrn }>> {
  if (!Array.isArray(items)) return { ok: false, status: 400, error: 'Položky musí být pole' }
  if (!(await loadZakazka(orgId, zakazkaId))) return { ok: false, status: 404, error: 'Zakázka nenalezena' }

  // Validace + normalizace
  const normalized = items.map((it, i) => {
    const popis = (it.popis ?? '').toString().trim()
    const dphSazba = toNum(it.dphSazba, 12)
    return {
      orgId,
      servisniZakazkaId: zakazkaId,
      typ: (POLOZKA_TYPY.includes(it.typ as PolozkaTyp) ? it.typ : 'PRACE') as PolozkaTyp,
      popis,
      mnozstvi: toNum(it.mnozstvi, 1),
      jednotka: (it.jednotka ?? 'ks').toString().slice(0, 16) || 'ks',
      cenaZaJednotku: it.cenaZaJednotku === null || it.cenaZaJednotku === undefined || it.cenaZaJednotku === ''
        ? null
        : toNum(it.cenaZaJednotku, 0),
      krytoKontraktem: Boolean(it.krytoKontraktem),
      dphSazba,
      poradi: i,
    }
  })

  for (const n of normalized) {
    if (!n.popis) return { ok: false, status: 400, error: 'Každá položka musí mít popis' }
    if (n.mnozstvi < 0) return { ok: false, status: 400, error: 'Množství nesmí být záporné' }
    if (n.dphSazba < 0 || n.dphSazba > 100) return { ok: false, status: 400, error: 'Neplatná sazba DPH' }
  }

  await prisma.$transaction(async (tx) => {
    await tx.servisniPolozka.deleteMany({ where: { servisniZakazkaId: zakazkaId, orgId } })
    if (normalized.length) await tx.servisniPolozka.createMany({ data: normalized })
  })

  return listPolozky(orgId, zakazkaId)
}

// Brána do fakturace: vyúčtovat lze jen s dokončeným protokolem.
// Idempotentní — opakované volání nic nemění.
export async function vyuctovat(
  orgId: string,
  zakazkaId: string,
): Promise<ServiceResult<{ id: string; stav: string }>> {
  const db = orgPrisma(orgId)
  const z = await loadZakazka(orgId, zakazkaId)
  if (!z) return { ok: false, status: 404, error: 'Zakázka nenalezena' }
  if (z.vyfakturovano) return { ok: true, data: { id: z.id, stav: z.stav } }
  if (!z.protokolDokoncen) {
    return { ok: false, status: 409, error: 'Nelze vyúčtovat bez dokončeného protokolu' }
  }

  const updated = await db.servisniZakazka.update({
    where: { id: zakazkaId },
    data: { stav: 'VYUCTOVANA', vyfakturovano: true, vyfakturovanoDatum: new Date() },
    select: { id: true, stav: true },
  })
  return { ok: true, data: updated }
}
