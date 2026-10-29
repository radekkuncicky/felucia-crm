import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms } from '@/lib/permissions'
import { AI_CONTEXT_MAX } from '@/lib/ai/kontext'

/** Firemní kontext pro AI asistentku — jen admin tenanta (nastaveniOrg), vždy jen vlastní org ze session */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).nastaveniOrg) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  if (typeof body.aiContext !== 'string') return NextResponse.json({ error: 'Chybí text' }, { status: 400 })
  const aiContext = body.aiContext.trim()
  if (aiContext.length > AI_CONTEXT_MAX) {
    return NextResponse.json({ error: `Kontext je příliš dlouhý (max ${AI_CONTEXT_MAX} znaků)` }, { status: 400 })
  }

  const orgId = session.user.orgId
  await orgPrisma(orgId).organization.update({ where: { id: orgId }, data: { aiContext: aiContext || null } })
  return NextResponse.json({ ok: true })
}
