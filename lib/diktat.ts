import type { OrgPrismaClient } from './orgPrisma'

/**
 * Diktát (procesní mapa C2): obchodník nadiktuje hovor / poznámku a ta se
 * uloží jako úkol na další den — aktivita UKOL bez rodiče (dealId i leadId
 * null, CHECK dovoluje nejvýš jednoho rodiče). Zpracuje ho ručně nebo Dáša:
 * založí lead / klienta / OP a diktát k nim připojí (pripojDiktat) — tím se
 * z úkolu stane dokončený hovor v historii leadu nebo OP.
 */

export const DIKTAT_MAX = 3000

/** Podmínka „aktivita je nezpracovaný diktát“ */
export const DIKTAT_WHERE = { dealId: null, leadId: null } as const

export function diktatHref(id: string) {
  return `/diktat/${id}`
}

/** „YYYY-MM-DD“ → Date (UTC půlnoc, jako ostatní aktivity bez času); jinak null */
export function parseDiktatDatum(v: unknown): Date | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(`${v}T00:00:00.000Z`)
  return isNaN(d.getTime()) ? null : d
}

/** Zítřek v Praze jako „YYYY-MM-DD“ */
export function zitraPraha(now = new Date()): string {
  const dnes = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(now)
  const d = new Date(`${dnes}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function parseDiktatText(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, DIKTAT_MAX) : null
}

export async function vytvorDiktat(
  db: OrgPrismaClient,
  orgId: string,
  userId: string,
  vstup: { text: string; datum: Date },
) {
  return db.activity.create({
    data: {
      orgId,
      userId,
      resitelId: userId,
      typ: 'UKOL',
      stav: 'PLANOVANA',
      popis: vstup.text,
      cil: 'Zpracovat diktát',
      datum: vstup.datum,
    },
    select: { id: true, datum: true },
  })
}

/**
 * Připojí diktát k leadu nebo OP: stane se z něj dokončený hovor s textem
 * diktátu, s datem nadiktování. Vrací text chyby, nebo null.
 */
export async function pripojDiktat(
  db: OrgPrismaClient,
  orgId: string,
  diktatId: string,
  rodic: { dealId: string } | { leadId: string },
): Promise<string | null> {
  const diktat = await db.activity.findFirst({ where: { id: diktatId, orgId, ...DIKTAT_WHERE }, select: { id: true, vytvoreno: true } })
  if (!diktat) return 'Diktát nenalezen nebo už je zpracovaný'
  if ('dealId' in rodic) {
    if (!(await db.deal.findFirst({ where: { id: rodic.dealId, orgId }, select: { id: true } }))) return 'OP nenalezen'
  } else {
    const lead = await db.lead.findFirst({ where: { id: rodic.leadId, orgId }, select: { status: true } })
    if (!lead) return 'Lead nenalezen'
    if (lead.status === 'NOVY') await db.lead.update({ where: { id: rodic.leadId }, data: { status: 'KONTAKTOVAN' } })
  }
  // updateMany s podmínkou bez rodiče — souběžné připojení nepřepíše první
  const r = await db.activity.updateMany({
    where: { id: diktatId, orgId, ...DIKTAT_WHERE },
    data: {
      ...('dealId' in rodic ? { dealId: rodic.dealId } : { leadId: rodic.leadId }),
      typ: 'HOVOR',
      stav: 'DOKONCENA',
      splneno: true,
      cil: null,
      datum: diktat.vytvoreno,
      reminderAt: null,
    },
  })
  return r.count ? null : 'Diktát už je zpracovaný'
}
