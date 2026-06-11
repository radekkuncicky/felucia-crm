import { prisma } from '@/lib/prisma'

/**
 * Vygeneruje číslo zakázky ve formátu RR-NNN.
 * Pokud je k dispozici kód OP (např. OP-26-042), zkusí převzít jeho číselnou část,
 * aby zakázka a OP sdílely stejné číslo — pokud už není obsazené.
 */
export async function generateZakazkaCislo(orgId: string, opKod?: string | null): Promise<string> {
  if (opKod) {
    const candidate = opKod.replace(/^OP-/, '')
    const exists = await prisma.zakazka.findFirst({ where: { orgId, cislo: candidate }, select: { id: true } })
    if (!exists) return candidate
  }

  const year = new Date().getFullYear().toString().slice(2)
  const last = await prisma.zakazka.findFirst({
    where: { orgId, cislo: { startsWith: `${year}-` } },
    orderBy: { cislo: 'desc' },
    select: { cislo: true },
  })
  const lastNum = last ? parseInt(last.cislo.split('-')[1] ?? '0', 10) : 0
  return `${year}-${String(lastNum + 1).padStart(3, '0')}`
}

/** Položky zakázky odvozené z aktivní nabídky OP. */
export async function polozkyZAktivniNabidky(dealId: string, orgId: string) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, orgId },
    include: {
      quotes: {
        where: { aktivni: true },
        include: { items: { orderBy: { poradi: 'asc' } } },
        take: 1,
      },
    },
  })
  const activeQuote = deal?.quotes[0] ?? null
  return (activeQuote?.items ?? []).map((item, idx) => ({
    nazev: item.nazev ?? '',
    kod: item.kod ?? null,
    mnozstvi: item.mnozstvi,
    jednotka: item.jednotka ?? 'ks',
    prodejniCena: item.cenaZaKus,
    dphSazba: item.dphSazba ?? activeQuote?.dphSazba ?? 12,
    poradi: idx,
    stav: 'CEKA' as const,
  }))
}

/**
 * Auto-vytvoření zakázky z OP (volá se při přechodu OP na USPECH).
 * Vrací vytvořenou zakázku, nebo null pokud už pro OP zakázka existuje.
 */
export async function createZakazkaFromDeal(dealId: string, orgId: string, vedouciId: string) {
  const existing = await prisma.zakazka.findFirst({ where: { opId: dealId, orgId }, select: { id: true } })
  if (existing) return null

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, orgId },
    include: { client: true },
  })
  if (!deal) return null

  const [cislo, polozky] = await Promise.all([
    generateZakazkaCislo(orgId, deal.kod),
    polozkyZAktivniNabidky(dealId, orgId),
  ])

  return prisma.zakazka.create({
    data: {
      orgId,
      cislo,
      opId: deal.id,
      klientId: deal.clientId,
      nazev: deal.predmet ?? `${deal.client.jmeno} ${deal.client.prijmeni}`.trim(),
      technologie: deal.technologie ?? null,
      vedouciId,
      stav: 'NOVA',
      polozky: polozky.length > 0 ? { create: polozky } : undefined,
    },
  })
}
