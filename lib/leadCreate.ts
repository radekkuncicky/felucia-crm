import type { Lead, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendPushToUsers } from '@/lib/push'
import { listUsersWithPerm } from '@/lib/zakazkyHelpers'

/**
 * Jediné místo, kde vzniká lead (hovor, webové formuláře, ruční založení, Dáša/MCP).
 * Vrací lead a `oznam()` — upozornění (zvonek + push do Felucia Sales) se posílá
 * AŽ PO COMMITU: volající v transakci zavolá oznam() po jejím doběhnutí, jinak hned.
 * oznam() nikdy nevyhazuje (fire-and-forget).
 *
 * Komu: přiřazený obchodník, jinak všichni s oprávněním `obchod` — vždy bez autora
 * (kdo lead zakládá sám, o něm ví). Webové leady respektují OrgSettings.notifNovyLead.
 */

type LeadDb = { lead: { create: (args: { data: Prisma.LeadUncheckedCreateInput }) => Promise<Lead> } }

export type VytvorLeadOpts = {
  /** kdo lead zakládá (null = web/API klíč) — tomu se nic neposílá */
  autorUserId: string | null
}

export async function vytvorLead(
  db: LeadDb,
  data: Prisma.LeadUncheckedCreateInput,
  opts: VytvorLeadOpts,
): Promise<{ lead: Lead; oznam: () => void }> {
  const lead = await db.lead.create({ data })
  return { lead, oznam: () => { oznamNovyLead(lead, opts.autorUserId).catch(e => console.error('[lead] oznámení selhalo:', e)) } }
}

/** Text pushe: „Jana Nováková · tepelné čerpadlo“ / první řádek zprávy */
export function leadPushText(lead: Pick<Lead, 'jmeno' | 'firma' | 'sluzba' | 'zprava'>): string {
  const kdo = lead.firma && lead.firma !== lead.jmeno ? `${lead.jmeno} (${lead.firma})` : lead.jmeno
  const co = lead.sluzba?.trim() || lead.zprava?.trim().split('\n')[0]?.slice(0, 80) || ''
  return co ? `${kdo} · ${co}` : kdo
}

/** Příjemci upozornění na nový lead (exportováno kvůli testům). */
export async function prijemciNovehoLeadu(
  lead: Pick<Lead, 'orgId' | 'assignedToId'>,
  autorUserId: string | null,
): Promise<string[]> {
  const ids = lead.assignedToId
    ? [lead.assignedToId]
    : (await listUsersWithPerm(lead.orgId, 'obchod')).map(u => u.id)
  return ids.filter(id => id !== autorUserId)
}

async function oznamNovyLead(lead: Lead, autorUserId: string | null): Promise<void> {
  const zWebu = lead.zdroj === 'WEB_FORMULAR'
  if (zWebu) {
    const settings = await prisma.orgSettings.findUnique({ where: { orgId: lead.orgId }, select: { notifNovyLead: true } })
    if (settings && !settings.notifNovyLead) return
  }
  const prijemci = await prijemciNovehoLeadu(lead, autorUserId)
  if (prijemci.length === 0) return

  const prirazeny = !!lead.assignedToId
  const titulek = zWebu ? 'Nový lead z webu' : prirazeny ? 'Přiřazen nový lead' : 'Nový lead'
  await prisma.notification.createMany({
    data: prijemci.map(userId => ({
      orgId: lead.orgId,
      userId,
      typ: 'NOVY_LEAD',
      zprava: `${titulek}: ${lead.jmeno}`,
      url: `/leady/${lead.id}`,
    })),
  })
  await sendPushToUsers(lead.orgId, prijemci, {
    title: titulek,
    body: leadPushText(lead),
    data: { type: 'lead', leadId: lead.id },
  })
}
