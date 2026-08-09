import { orgPrisma } from './orgPrisma'
import { prisma } from './prisma'
import { createZakazkaFromDeal } from './zakazkaWorkflow'
import { createNotification } from './createNotification'
import { getOrgSettings } from './orgSettings'
import { getPlanLimits } from './planLimits'
import { logAction } from './auditLog'

/**
 * Přechod OP na USPECH po podpisu smlouvy (na místě i na dálku) — stejné
 * vedlejší efekty jako ruční přechod na webu: zakázka, volitelně zařízení
 * (automatickyServis), zvonky adminům a vlastníkovi. Kontrola povinné
 * aktivity se záměrně přeskakuje — podepsaná smlouva je silnější důkaz
 * než zalogovaný hovor.
 */
export async function prevedDealNaUspechPoPodpisu(params: {
  orgId: string
  dealId: string
  /** kdo přechod spustil (obchodník na místě / odesílatel u podpisu na dálku) */
  userId: string | null
}): Promise<{ zmeneno: boolean; zakazkaId: string | null }> {
  const { orgId, dealId, userId } = params
  const db = orgPrisma(orgId)

  const deal = await db.deal.findFirst({
    where: { id: dealId },
    select: {
      id: true, kod: true, predmet: true, stav: true, userId: true,
      clientId: true, technologie: true, terminRealizace: true,
    },
  })
  if (!deal || deal.stav === 'USPECH') return { zmeneno: false, zakazkaId: null }

  await db.deal.update({
    where: { id: dealId },
    data: { stav: 'USPECH', duvodProhry: null, duvodProhryKod: null },
  })

  const zakazka = await createZakazkaFromDeal(dealId, orgId, userId ?? deal.userId)

  // Auto-zařízení pro servis — stejná podmínka jako na webu (plán + nastavení org)
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } })
  if (org && getPlanLimits(org.plan).hasServiceModule) {
    const settings = await getOrgSettings(orgId)
    if (settings.automatickyServis) {
      const existing = await db.zarizeni.findFirst({ where: { dealId }, select: { id: true } })
      if (!existing) {
        const nazvy: Record<string, string> = {
          TEPELNE_CERPADLO: 'Tepelné čerpadlo', KLIMA: 'Klimatizace', REKUPERACE: 'Rekuperace',
          PODLAHOVE_TOPENI: 'Podlahové topení', VZDUCHOTECHNIKA: 'Vzduchotechnika', JINE: 'Zařízení',
        }
        const typy: Record<string, string> = {
          TEPELNE_CERPADLO: 'TEPELNE_CERPADLO', KLIMA: 'KLIMATIZACE', REKUPERACE: 'REKUPERACE',
          PODLAHOVE_TOPENI: 'PODLAHOVE_VYTAPENI', VZDUCHOTECHNIKA: 'VZDUCHOTECHNIKA', JINE: 'JINE',
        }
        await db.zarizeni.create({
          data: {
            orgId,
            klientId: deal.clientId,
            dealId: deal.id,
            nazev: deal.predmet || nazvy[deal.technologie] || 'Zařízení',
            typ: (typy[deal.technologie] || 'JINE') as never,
            datumInstalace: deal.terminRealizace ?? null,
          },
        })
      }
    }
  }

  const admins = await db.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
  const prijemci = new Set(admins.map(a => a.id))
  if (deal.userId) prijemci.add(deal.userId)
  await Promise.all(Array.from(prijemci).map(uid =>
    createNotification({
      orgId,
      userId: uid,
      typ: 'OP_USPECH',
      zprava: `OP ${deal.kod ?? ''} vyhrán — smlouva podepsána`.replace('  ', ' '),
      dealId: deal.id,
    }),
  ))

  await logAction({
    orgId,
    userId: userId ?? deal.userId ?? undefined,
    typAkce: 'UPDATE',
    typZaznamu: 'Deal',
    zaznamId: deal.id,
    zaznamNazev: `${deal.kod ?? ''} ${deal.predmet ?? ''}`.trim(),
    zmeny: { stav: { z: deal.stav, na: 'USPECH' }, zdroj: 'podpis-smlouvy' },
  })

  return { zmeneno: true, zakazkaId: zakazka?.id ?? null }
}
