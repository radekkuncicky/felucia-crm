/**
 * Synchronizace vydaných faktur z ABRA Flexi do `AbraFaktura` (jen čtení z Flexi).
 *
 * Pokaždé celé zrcadlo od HISTORIE_OD: upsert podle Flexi ID, co ve Flexi už
 * není (smazané doklady), se smaže i u nás. Zakázka se páruje podle čísla —
 * hlavička faktury bývá prázdná, NANTO ji vyplňuje na položkách. Koncovka
 * „-N“ (26-047-1) = etapa N zakázky 26-047, pokud zakázka s celým číslem není.
 */
import type { PrismaClient } from '@prisma/client'
import { abraGet, type AbraKonfigurace } from './flexi'
import { prahaPulnoc, HISTORIE_OD } from '../kpi/obdobi'

export type AbraFakturaTyp = 'FAKTURA' | 'ZALOHA' | 'DOBROPIS' | 'JINE'

interface FlexiFaktura {
  id: string
  kod: string
  typDokl: string
  'firma@showAs'?: string
  zakazka?: string
  datVyst: string
  datSplat?: string
  datUhr?: string
  sumCelkem: string
  sumDphCelkem: string
  zbyvaUhradit: string
  stavUhrK?: string
  polozkyFaktury?: { zakazka?: string }[]
}

const POLE = 'id,kod,typDokl,firma,zakazka,datVyst,datSplat,datUhr,sumCelkem,sumDphCelkem,zbyvaUhradit,stavUhrK,polozkyFaktury(zakazka)'

export function typFaktury(typDokl: string): AbraFakturaTyp {
  const kod = typDokl.replace(/^code:/, '')
  if (kod.startsWith('FAKTURA')) return 'FAKTURA' // FAKTURA CZK i FAKTURA PDP
  if (kod === 'ZÁLOHA') return 'ZALOHA'
  if (kod === 'DOBROPIS') return 'DOBROPIS'
  return 'JINE'
}

/** Flexi datum „2026-10-27+01:00“ → pražská půlnoc toho dne; prázdné → null */
export function flexiDatum(v: string | undefined): Date | null {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? prahaPulnoc(Number(m[1]), Number(m[2]), Number(m[3])) : null
}

/** Číslo zakázky faktury: hlavička, jinak první vyplněná položka */
export function zakazkaFaktury(f: Pick<FlexiFaktura, 'zakazka' | 'polozkyFaktury'>): string | null {
  const kod = f.zakazka || f.polozkyFaktury?.find(p => p.zakazka)?.zakazka
  return kod ? kod.replace(/^code:/, '') : null
}

/** Číslo z Flexi → zakázka Felucie (+ etapa z koncovky), podle mapy cislo → id */
export function sparujZakazku(kod: string | null, zakazky: Map<string, string>): { zakazkaId: string | null; etapaCislo: number | null } {
  if (!kod) return { zakazkaId: null, etapaCislo: null }
  const presne = zakazky.get(kod)
  if (presne) return { zakazkaId: presne, etapaCislo: null }
  const m = kod.match(/^(.+)-(\d{1,2})$/)
  const zaklad = m && zakazky.get(m[1])
  return zaklad ? { zakazkaId: zaklad, etapaCislo: Number(m![2]) } : { zakazkaId: null, etapaCislo: null }
}

export async function stahniFaktury(k: AbraKonfigurace): Promise<FlexiFaktura[]> {
  return abraGet<FlexiFaktura>(k, 'faktura-vydana', {
    filtr: `datVyst >= '${HISTORIE_OD}-01'`,
    params: { limit: '0', detail: `custom:${POLE}`, relations: 'polozkyFaktury' },
  })
}

export async function ulozFaktury(prisma: PrismaClient, orgId: string, faktury: FlexiFaktura[]) {
  const zakazky = new Map(
    (await prisma.zakazka.findMany({ where: { orgId }, select: { id: true, cislo: true } })).map(z => [z.cislo, z.id]),
  )
  let sparovano = 0
  for (const f of faktury) {
    const vystaveno = flexiDatum(f.datVyst)
    if (!vystaveno) continue
    const zakazkaKod = zakazkaFaktury(f)
    const { zakazkaId, etapaCislo } = sparujZakazku(zakazkaKod, zakazky)
    if (zakazkaId) sparovano++
    const celkem = Number(f.sumCelkem)
    const data = {
      kod: f.kod,
      typ: typFaktury(f.typDokl),
      typDokl: f.typDokl.replace(/^code:/, ''),
      odberatel: f['firma@showAs']?.replace(/^[^:]*:\s*/, '') || null,
      zakazkaKod,
      zakazkaId,
      etapaCislo,
      vystaveno,
      splatnost: flexiDatum(f.datSplat),
      uhrazeno: flexiDatum(f.datUhr),
      celkemSDph: celkem,
      celkemBezDph: celkem - Number(f.sumDphCelkem),
      zbyvaUhradit: Number(f.zbyvaUhradit),
      stavUhrady: f.stavUhrK?.replace(/^stavUhr\./, '') || null,
    }
    await prisma.abraFaktura.upsert({
      where: { orgId_abraId: { orgId, abraId: Number(f.id) } },
      create: { orgId, abraId: Number(f.id), ...data },
      update: data,
    })
  }
  // Doklady smazané ve Flexi — jen když stažení proběhlo (prázdná odpověď ≠ smazat vše)
  const smazano = faktury.length
    ? (await prisma.abraFaktura.deleteMany({ where: { orgId, abraId: { notIn: faktury.map(f => Number(f.id)) } } })).count
    : 0
  return { celkem: faktury.length, sparovano, smazano }
}

export async function synchronizujAbra(prisma: PrismaClient, k: AbraKonfigurace) {
  const org = await prisma.organization.findUnique({ where: { slug: k.orgSlug }, select: { id: true } })
  if (!org) throw new Error(`ABRA_FLEXI_ORG_SLUG: organizace ${k.orgSlug} neexistuje`)
  return ulozFaktury(prisma, org.id, await stahniFaktury(k))
}
