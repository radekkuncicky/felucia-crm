import { orgPrisma } from '@/lib/orgPrisma'
import { getPlanLimits } from '@/lib/planLimits'

/**
 * Smí org teď použít AI (plán + měsíční kredity)? Stejná pravidla jako
 * Dáša (app/api/ai-assistant), včetně měsíčního resetu počítadla.
 * Vrací null = OK, jinak { status, error } k vrácení klientovi.
 */
export async function overAiKredity(orgId: string): Promise<{ status: 403 | 429 | 503; error: string } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return { status: 503, error: 'AI není na serveru nastavené.' }
  const db = orgPrisma(orgId)
  const org = await db.organization.findUnique({ where: { id: orgId } })
  const limity = getPlanLimits(org?.plan ?? 'STARTER')
  if (!limity.canUseAI) return { status: 403, error: 'AI není dostupná na vašem plánu.' }

  let pouzito = org?.aiCreditsUsed ?? 0
  const now = new Date()
  const resetAt = org?.aiTokensResetAt ?? now
  if ((now.getFullYear() - resetAt.getFullYear()) * 12 + (now.getMonth() - resetAt.getMonth()) >= 1) {
    await db.organization.update({ where: { id: orgId }, data: { aiTokensUsed: 0, aiCreditsUsed: 0, aiTokensResetAt: now } })
    pouzito = 0
  }
  const limit = limity.aiCreditsPerMonth
  const celkem = limit === Infinity ? Infinity : (limit as number) + (org?.aiCreditsExtra ?? 0)
  if (celkem !== Infinity && pouzito >= celkem) {
    return { status: 429, error: `Došly měsíční AI kredity (${pouzito}/${celkem}). Diktát zůstal uložený, učešete ho příští měsíc nebo po dokoupení kreditů.` }
  }
  return null
}
