import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin } from '@/lib/mobile-helpers'

// PATCH /api/mobile/vykaz/nastaveni { pripominka: boolean } — večerní připomínka zápisu (18:00)
export async function PATCH(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  let body: { pripominka?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (typeof body?.pripominka !== 'boolean') return NextResponse.json({ error: 'Neplatné nastavení' }, { status: 400 })

  const { orgId, id } = session!.user
  await orgPrisma(orgId).user.updateMany({ where: { id, orgId }, data: { vykazPripominka: body.pripominka } })
  return NextResponse.json({ pripominka: body.pripominka })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
