import { orgPrisma } from '@/lib/orgPrisma'
import { firemniKontextSekce } from './kontext'

/**
 * Sekce systémového promptu s kontextem firmy. orgId MUSÍ pocházet ze session
 * (web) nebo z ověřeného tokenu (MCP) — kontext jedné firmy se nesmí dostat k jiné.
 */
export async function nactiFiremniKontext(orgId: string): Promise<string> {
  const org = await orgPrisma(orgId).organization.findUnique({ where: { id: orgId }, select: { aiContext: true } })
  return firemniKontextSekce(org?.aiContext)
}
