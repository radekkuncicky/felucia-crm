import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin } from '@/lib/mobile-helpers'
import { parseSazba } from '@/lib/vykazPrace'

const ser = (u: { sazbaHodina: unknown; sazbaKm: unknown } | null) => ({
  sazbaHodina: u?.sazbaHodina == null ? null : Number(u.sazbaHodina),
  sazbaKm: u?.sazbaKm == null ? null : Number(u.sazbaKm),
})

// GET /api/mobile/vykaz/sazby — vlastní sazby technika (Kč/hod, Kč/km)
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr
  const { orgId, id } = session!.user
  const u = await orgPrisma(orgId).user.findFirst({ where: { id, orgId }, select: { sazbaHodina: true, sazbaKm: true } })
  return NextResponse.json(ser(u))
}

// PATCH /api/mobile/vykaz/sazby { sazbaHodina?, sazbaKm? } — platí pro nové záznamy, staré drží sazbu ze zápisu
export async function PATCH(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const data: { sazbaHodina?: number | null; sazbaKm?: number | null } = {}
  for (const key of ['sazbaHodina', 'sazbaKm'] as const) {
    if (!(key in body)) continue
    const v = parseSazba(body[key])
    if (v === 'chyba') return NextResponse.json({ error: 'Neplatná sazba' }, { status: 400 })
    data[key] = v
  }

  const { orgId, id } = session!.user
  const db = orgPrisma(orgId)
  await db.user.updateMany({ where: { id, orgId }, data })
  const u = await db.user.findFirst({ where: { id, orgId }, select: { sazbaHodina: true, sazbaKm: true } })
  return NextResponse.json(ser(u))
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
