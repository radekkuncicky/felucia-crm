import { TypAktivity } from '@prisma/client'
import type { Prisma } from '@prisma/client'

/**
 * Sdílená pravidla aktivit. Aktivita visí buď na OP (dealId), nebo na leadu
 * (leadId) — přesně jeden rodič, hlídá i CHECK v DB (migrace activity_lead).
 * Na leadu jsou povolené jen hovory a e-maily.
 */

export const LEAD_TYPY: TypAktivity[] = ['HOVOR', 'EMAIL']

export const TYP_LABEL: Record<string, string> = {
  HOVOR: 'Hovor',
  EMAIL: 'E-mail',
  SCHUZKA: 'Schůzka',
  POZNAMKA: 'Poznámka',
  UKOL: 'Úkol',
}

const TYPY = Object.values(TypAktivity) as string[]

export function parseTyp(v: unknown): TypAktivity | null {
  return typeof v === 'string' && TYPY.includes(v) ? (v as TypAktivity) : null
}

/** Typ povolený pro daného rodiče (lead jen HOVOR/EMAIL). */
export function typPovolen(typ: TypAktivity, parent: { leadId: string | null }): boolean {
  return !parent.leadId || LEAD_TYPY.includes(typ)
}

/** Lead je uzavřený — aktivity na něm už nejdou zakládat ani měnit. */
export function leadUzavren(status: string): boolean {
  return status === 'PREVEDEN' || status === 'ZRUSEN'
}

/** Zúží aktivity dotazované přes OP na ty s načteným dealem (typová pomůcka). */
export function hasDeal<T extends { deal: unknown }>(a: T): a is T & { deal: NonNullable<T['deal']> } {
  return a.deal != null
}

export type FollowUpInput = { typ: TypAktivity; datum: Date; popis: string | null }

/**
 * Validuje `followUp` z těla požadavku (typ + datum povinné, poznámka volitelná).
 * Vrací null, když follow-up nepřišel; string = chybová hláška.
 */
export function parseFollowUp(
  raw: unknown,
  parent: { leadId: string | null },
): FollowUpInput | null | string {
  if (raw == null) return null
  if (typeof raw !== 'object') return 'Neplatná navazující aktivita'
  const r = raw as Record<string, unknown>
  const typ = parseTyp(r.typ)
  if (!typ) return 'Neplatný typ navazující aktivity'
  if (!typPovolen(typ, parent)) return 'U leadu lze plánovat jen hovor nebo e-mail'
  const datum = typeof r.datum === 'string' ? new Date(r.datum) : null
  if (!datum || isNaN(datum.getTime())) return 'Chybí datum navazující aktivity'
  const popis = typeof r.popis === 'string' && r.popis.trim() ? r.popis.trim() : null
  return { typ, datum, popis }
}

/** Navazující aktivita na stejném rodiči (OP/lead), zdědí řešitele. */
export function followUpData(
  source: { orgId: string; dealId: string | null; leadId: string | null; resitelId: string | null },
  input: FollowUpInput,
  userId: string,
): Prisma.ActivityUncheckedCreateInput {
  return {
    orgId: source.orgId,
    dealId: source.dealId,
    leadId: source.leadId,
    userId,
    resitelId: source.resitelId ?? userId,
    typ: input.typ,
    datum: input.datum,
    popis: input.popis,
    stav: 'PLANOVANA',
  }
}

type KlientLike = { jmeno?: string | null; prijmeni?: string | null } | null | undefined
type LeadLike = { id: string; jmeno: string; firma?: string | null }
type DealLike = { id: string; kod?: string | null; predmet?: string | null; client?: KlientLike }

/** Jméno leadu pro zobrazení: „Jan Novák (Firma s.r.o.)" */
export function leadJmeno(l: { jmeno: string; firma?: string | null }): string {
  return l.firma && l.firma !== l.jmeno ? `${l.jmeno} (${l.firma})` : l.jmeno
}

/**
 * Rodič aktivity pro texty a odkazy: klient, popisek kontextu a URL.
 * `href` míří na tab aktivit OP, resp. na detail leadu.
 */
export function activityParent(a: { deal?: DealLike | null; lead?: LeadLike | null }): {
  druh: 'DEAL' | 'LEAD'
  id: string
  klient: string
  kontextLabel: string
  kontext: string
  href: string
} | null {
  if (a.deal) {
    const klient = [a.deal.client?.jmeno, a.deal.client?.prijmeni].filter(Boolean).join(' ').trim()
    return {
      druh: 'DEAL',
      id: a.deal.id,
      klient,
      kontextLabel: 'Obchodní případ',
      kontext: [a.deal.kod, a.deal.predmet].filter(Boolean).join(' · ') || 'obchodní případ',
      href: `/deals/${a.deal.id}?tab=aktivity`,
    }
  }
  if (a.lead) {
    return {
      druh: 'LEAD',
      id: a.lead.id,
      klient: leadJmeno(a.lead),
      kontextLabel: 'Lead',
      kontext: 'Lead',
      href: `/leady/${a.lead.id}`,
    }
  }
  return null
}
