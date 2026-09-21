import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, canAccessZakazka } from '@/lib/mobile-helpers'
import { UKOL_SELECT } from '@/lib/zakazkaUkol'

/** Technik v terénu: odškrtnout / vrátit úkol zakázky. Body: { hotovo: boolean } */
export async function PATCH(req: Request, { params }: { params: { id: string; ukolId: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  if (!(await canAccessZakazka(session!, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const hotovo = (body as { hotovo?: unknown })?.hotovo
  if (typeof hotovo !== 'boolean') return NextResponse.json({ error: 'hotovo musí být boolean' }, { status: 400 })

  const db = orgPrisma(session!.user.orgId)
  const existing = await db.zakazkaUkol.findFirst({ where: { id: params.ukolId, zakazkaId: params.id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ukol = await db.zakazkaUkol.update({
    where: { id: params.ukolId },
    data: { hotovo, hotovoAt: hotovo ? new Date() : null, hotovoId: hotovo ? session!.user.id : null },
    select: UKOL_SELECT,
  })
  return NextResponse.json(ukol)
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
