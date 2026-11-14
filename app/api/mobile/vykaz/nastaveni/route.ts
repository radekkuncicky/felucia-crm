import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin } from '@/lib/mobile-helpers'

// GET /api/mobile/vykaz/nastaveni — { pouzivat, pripominka }
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId, id } = session!.user
  const u = await orgPrisma(orgId).user.findFirst({ where: { id, orgId }, select: { vykazPouzivat: true, vykazPripominka: true } })
  return NextResponse.json({ pouzivat: u?.vykazPouzivat ?? true, pripominka: u?.vykazPripominka ?? true })
}

// PATCH /api/mobile/vykaz/nastaveni { pouzivat?: boolean, pripominka?: boolean }
// pouzivat = výkaz práce v appce vůbec (sekce Hodiny a km + připomínka), pripominka = večerní push 18:00
export async function PATCH(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  let body: { pripominka?: unknown; pouzivat?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const data: { vykazPripominka?: boolean; vykazPouzivat?: boolean } = {}
  if (typeof body?.pripominka === 'boolean') data.vykazPripominka = body.pripominka
  if (typeof body?.pouzivat === 'boolean') data.vykazPouzivat = body.pouzivat
  if (Object.keys(data).length === 0 || (body.pripominka !== undefined && typeof body.pripominka !== 'boolean') || (body.pouzivat !== undefined && typeof body.pouzivat !== 'boolean')) {
    return NextResponse.json({ error: 'Neplatné nastavení' }, { status: 400 })
  }

  const { orgId, id } = session!.user
  const db = orgPrisma(orgId)
  await db.user.updateMany({ where: { id, orgId }, data })
  const u = await db.user.findFirst({ where: { id, orgId }, select: { vykazPouzivat: true, vykazPripominka: true } })
  return NextResponse.json({ pouzivat: u?.vykazPouzivat ?? true, pripominka: u?.vykazPripominka ?? true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
