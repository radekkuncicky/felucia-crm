import { prisma } from './prisma'
import { getPlanLimits } from './planLimits'

/**
 * Přístup k online podpisu smluv:
 *  - PROFESSIONAL/ENTERPRISE: v ceně plánu, bez limitu
 *  - STANDARD: příplatkový modul 99 Kč/licence/měsíc, limit 100 odeslaných
 *    smluv za kalendářní měsíc (Organization.modulPodpisy přes Stripe)
 */

export const PODPISY_MESICNI_LIMIT = 100
export const PODPISY_CENA_LICENCE = 99

export interface PodpisyAccess {
  allowed: boolean
  zdroj: 'PLAN' | 'MODUL' | null
  /** null = bez limitu */
  limit: number | null
  /** odeslané smlouvy v aktuálním kalendářním měsíci (jen u modulu) */
  vyuzito: number
  /** STANDARD bez aktivního modulu — UI nabídne aktivaci místo upgrade */
  muzeAktivovatModul: boolean
}

export async function getPodpisyAccess(orgId: string, plan: string): Promise<PodpisyAccess> {
  if (getPlanLimits(plan).hasOnlinePodpis) {
    return { allowed: true, zdroj: 'PLAN', limit: null, vyuzito: 0, muzeAktivovatModul: false }
  }
  if (plan !== 'STANDARD') {
    return { allowed: false, zdroj: null, limit: null, vyuzito: 0, muzeAktivovatModul: false }
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { modulPodpisy: true },
  })
  if (!org?.modulPodpisy) {
    return { allowed: false, zdroj: null, limit: null, vyuzito: 0, muzeAktivovatModul: true }
  }

  const zacatekMesice = new Date()
  zacatekMesice.setDate(1)
  zacatekMesice.setHours(0, 0, 0, 0)
  const vyuzito = await prisma.sodPodpisRelace.count({
    where: { orgId, vytvoreno: { gte: zacatekMesice } },
  })

  return {
    allowed: vyuzito < PODPISY_MESICNI_LIMIT,
    zdroj: 'MODUL',
    limit: PODPISY_MESICNI_LIMIT,
    vyuzito,
    muzeAktivovatModul: false,
  }
}
