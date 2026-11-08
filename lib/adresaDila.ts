import { prisma } from '@/lib/prisma'
import type { OrgPrismaClient } from '@/lib/orgPrisma'

type Db = typeof prisma | OrgPrismaClient

const neplatneStavy = ['STORNO', 'EXPIROVANO'] as const

function cisty(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

/**
 * Místo instalace pro zakázku z OP: adresa díla ze SOD (podepsaná má přednost,
 * jinak nejnovější platná), jinak adresa díla na OP.
 */
export async function adresaDilaProDeal(dealId: string, orgId: string, db: Db = prisma): Promise<string | null> {
  const sody = await (db as typeof prisma).sod.findMany({
    where: { dealId, orgId, stav: { notIn: [...neplatneStavy] }, adresaDila: { not: null } },
    select: { adresaDila: true, stav: true, vytvoreno: true },
    orderBy: { vytvoreno: 'desc' },
  })
  const platne = sody.filter((s) => cisty(s.adresaDila))
  const vybrana = platne.find((s) => s.stav === 'PODEPSANO') ?? platne[0]
  if (vybrana) return cisty(vybrana.adresaDila)

  const deal = await (db as typeof prisma).deal.findFirst({ where: { id: dealId, orgId }, select: { adresaDila: true } })
  return cisty(deal?.adresaDila)
}

/**
 * Adresa díla zadaná ve SOD se propíše do OP a do už existující zakázky,
 * pokud ta místo stavby ještě nemá (vyplněné se nepřepisuje).
 */
export async function propisAdresuDila(dealId: string, orgId: string, adresa: string | null | undefined, db: Db = prisma) {
  const a = cisty(adresa)
  if (!a) return
  const client = db as typeof prisma
  await client.deal.updateMany({ where: { id: dealId, orgId }, data: { adresaDila: a } })
  await client.zakazka.updateMany({
    where: { opId: dealId, orgId, OR: [{ mistoStavby: null }, { mistoStavby: '' }] },
    data: { mistoStavby: a },
  })
}
