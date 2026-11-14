import { Prisma, Technologie, type Lead, type TypKlienta } from '@prisma/client'
import type { orgPrisma } from '@/lib/orgPrisma'
import { leadPredmet, sluzbaToTechnologie } from '@/lib/leadService'
import { generateDealKod } from '@/lib/dealKod'
import { createWithUniqueKod } from '@/lib/uniqueKod'
import { checkDealLimit } from '@/lib/checkPlanLimit'
import { najdiDuplicitnihoKlienta, normalizeEmail, normalizePhone } from '@/lib/clientDuplicate'

/**
 * Převod leadu na OP (+ klienta) — sdílí web (/api/leady/[id]/convert) a Felucia Sales
 * (/api/mobile/obchod/leady/[id]/prevest).
 */

type Db = ReturnType<typeof orgPrisma>

const TECHNOLOGIE_VALUES = new Set<string>(Object.values(Technologie))

export type KandidatKlienta = { id: string; nazev: string; telefon: string | null; email: string | null; duvod: 'telefon' | 'email' | 'jmeno' }

/** Existující klient, ke kterému lead nejspíš patří (telefon / e-mail, bez kontaktu jméno/firma). */
export async function kandidatKlientaLeadu(db: Db, orgId: string, lead: Lead): Promise<KandidatKlienta | null> {
  const klienti = await db.client.findMany({
    where: { orgId },
    select: { id: true, jmeno: true, prijmeni: true, telefon: true, email: true, typKlienta: true },
  })
  const firma = lead.firma?.trim()
  // U firem porovnávat jen název (prijmeni = kontaktní osoba)
  const match = najdiDuplicitnihoKlienta(klienti.map(k => k.typKlienta === 'FIRMA' ? { ...k, prijmeni: '' } : k), {
    // Firma je v klientech uložená v `jmeno` (název), osoba jako „jméno příjmení"
    jmeno: firma || lead.jmeno,
    prijmeni: null,
    telefon: lead.telefon,
    email: lead.email,
  })
  if (!match) return null

  const duvod = lead.telefon && normalizePhone(lead.telefon) === normalizePhone(match.telefon)
    ? 'telefon'
    : lead.email && normalizeEmail(lead.email) === normalizeEmail(match.email)
      ? 'email'
      : 'jmeno'
  const k = klienti.find(x => x.id === match.id)!
  return {
    id: k.id,
    nazev: k.typKlienta === 'FIRMA' ? k.jmeno : `${k.jmeno} ${k.prijmeni}`.trim(),
    telefon: k.telefon,
    email: k.email,
    duvod,
  }
}

export type PrevodVstup = {
  technologie?: unknown
  predmet?: unknown
  typKlienta?: unknown
  existingClientId?: unknown
}

export type PrevodVysledek =
  | { ok: true; dealId: string; clientId: string; kod: string | null }
  | { ok: false; status: number; error: string; upgradeUrl?: string }

export async function prevedLead(
  db: Db,
  orgId: string,
  userId: string,
  leadId: string,
  body: PrevodVstup,
): Promise<PrevodVysledek> {
  const lead = await db.lead.findFirst({ where: { id: leadId, orgId } })
  if (!lead) return { ok: false, status: 404, error: 'Lead nenalezen.' }
  if (lead.status === 'PREVEDEN') return { ok: false, status: 400, error: 'Lead je již převeden.' }

  if (body.technologie !== undefined && body.technologie !== null && !TECHNOLOGIE_VALUES.has(String(body.technologie))) {
    return { ok: false, status: 400, error: `Neplatná technologie: ${body.technologie}` }
  }
  if (!(await checkDealLimit(orgId))) {
    return {
      ok: false, status: 403, error: 'Dosáhli jste limitu obchodních případů pro váš plán. Vyšší plán má neomezený počet.',
      upgradeUrl: '/settings/billing',
    }
  }
  const technologie: Technologie = (body.technologie as Technologie) || sluzbaToTechnologie(lead.sluzba)
  const predmet = typeof body.predmet === 'string' && body.predmet.trim() ? body.predmet.trim() : leadPredmet(lead)

  let clientId: string
  let createdNewClient = false

  if (typeof body.existingClientId === 'string' && body.existingClientId) {
    const existing = await db.client.findFirst({ where: { id: body.existingClientId, orgId }, select: { id: true } })
    if (!existing) return { ok: false, status: 404, error: 'Klient nenalezen.' }
    clientId = existing.id
  } else {
    if (!lead.jmeno?.trim()) {
      return { ok: false, status: 400, error: 'Lead nemá vyplněné jméno, klienta nelze založit.' }
    }
    // Firma: jmeno = název firmy, prijmeni = kontaktní osoba (jako clients/new).
    // Osoba: rozděl jméno na jmeno + prijmeni.
    const firma = lead.firma?.trim()
    const nameParts = lead.jmeno.trim().split(' ')
    const jmeno = firma || nameParts[0] || lead.jmeno
    const prijmeni = firma ? lead.jmeno.trim() : (nameParts.slice(1).join(' ') || '')
    const typKlienta: TypKlienta = firma ? 'FIRMA' : body.typKlienta === 'FIRMA' ? 'FIRMA' : 'FYZICKA_OSOBA'

    const klient = await db.client.create({
      data: {
        orgId,
        typKlienta,
        jmeno,
        prijmeni,
        email: lead.email || null,
        telefon: lead.telefon || null,
        poznamka: lead.zprava ? `Původní zpráva z leadu:\n${lead.zprava}` : null,
      },
    })
    clientId = klient.id
    createdNewClient = true
  }

  // OP + přepnutí leadu jedním zápisem per pokus. Číslo OP (kod) může kolidovat
  // se souběžně vznikajícím OP jinde v appce (unique orgId+kod) — createWithUniqueKod
  // číslo přegeneruje a zkusí znovu v čerstvé transakci.
  try {
    const deal = await createWithUniqueKod(
      () => generateDealKod(orgId),
      kod => db.$transaction(async tx => {
        const deal = await tx.deal.create({
          data: {
            orgId,
            clientId,
            userId,
            kod,
            technologie,
            stav: 'NOVY',
            predmet,
            zdrojPoptavkyId: lead.zdrojPoptavkyId,
            doporucilKlientId: lead.doporucilKlientId,
            doporucilText: lead.doporucilText,
          },
        })
        // podmíněně: souběžný převod téhož leadu (web + appka) nesmí vyrobit dva OP
        const prepnuto = await tx.lead.updateMany({
          where: { id: leadId, status: { not: 'PREVEDEN' } },
          data: { status: 'PREVEDEN', prevedenNaOpId: deal.id, prevedenNaKlientId: clientId },
        })
        if (prepnuto.count === 0) throw new LeadUzPreveden()
        // Hovory/e-maily z leadu pokračují na OP (historie i naplánované)
        await tx.activity.updateMany({
          where: { leadId },
          data: { leadId: null, dealId: deal.id },
        })
        return deal
      }),
    )
    return { ok: true, dealId: deal.id, clientId, kod: deal.kod }
  } catch (e) {
    // Nový klient bez vazby na OP by zůstal osiřelý — při definitivním selhání ho smažeme.
    if (createdNewClient) await db.client.delete({ where: { id: clientId } }).catch(() => {})
    if (e instanceof LeadUzPreveden) return { ok: false, status: 400, error: 'Lead je již převeden.' }
    console.error(`[leadPrevod] selhal převod leadu ${leadId} (org ${orgId}):`, e)
    const error = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
      ? 'Převod se nezdařil kvůli kolizi čísla OP, zkuste to prosím znovu.'
      : 'Převod se nezdařil kvůli neočekávané chybě, zkuste to prosím znovu nebo kontaktujte podporu.'
    return { ok: false, status: 500, error }
  }
}

class LeadUzPreveden extends Error {}
