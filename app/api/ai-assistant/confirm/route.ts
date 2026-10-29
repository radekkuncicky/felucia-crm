import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getPlanLimits } from '@/lib/planLimits'
import { checkRateLimit } from '@/lib/rateLimit'
import { getPerms } from '@/lib/permissions'
import { pokracujPoPotvrzeni, zapisSpotrebu } from '@/lib/ai/agent'
import { odpovedKlientovi } from '@/lib/ai/odpoved'
import type { AiKontext } from '@/lib/ai/types'

/**
 * Potvrzení / zrušení zápisů, které Dáša navrhla (karta v chatu).
 * Klient posílá jen ID návrhu — co se zapíše, je uložené na serveru.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { limited } = checkRateLimit(`ai-assistant:${session.user.id}`, 30, 60 * 1000)
  if (limited) return NextResponse.json({ error: 'Příliš mnoho požadavků. Zkuste to za chvíli.' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  if (typeof body.id !== 'string' || typeof body.potvrdit !== 'boolean') {
    return NextResponse.json({ error: 'Neplatný požadavek' }, { status: 400 })
  }

  const orgId = session.user.orgId
  const org = await orgPrisma(orgId).organization.findUnique({ where: { id: orgId } })
  const planLimits = getPlanLimits(org?.plan ?? 'STARTER')
  if (!planLimits.canUseAI) return NextResponse.json({ error: 'AI asistentka není dostupná na vašem plánu.' }, { status: 403 })

  const ctx: AiKontext = {
    orgId, userId: session.user.id, role: session.user.role, jmeno: session.user.jmeno,
    perms: getPerms(session.user), zdroj: 'web',
  }

  try {
    const r = await pokracujPoPotvrzeni({ ctx, cekajiciId: body.id, potvrdit: body.potvrdit })
    if (!r.ok) return NextResponse.json({ error: r.chyba }, { status: 409 })
    const credits = await zapisSpotrebu(ctx, r.model, r.dalsi.usage)
    return NextResponse.json({
      ...odpovedKlientovi(r.dalsi, (org?.aiCreditsUsed ?? 0) + credits, planLimits.aiCreditsPerMonth),
      provedeno: r.provedeno,
    })
  } catch (err) {
    console.error('[ai-chat] confirm error:', err)
    return NextResponse.json({ error: err instanceof Anthropic.APIError ? 'AI service error' : 'Internal server error' }, { status: 502 })
  }
}
