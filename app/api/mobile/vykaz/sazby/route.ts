import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin } from '@/lib/mobile-helpers'

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

// PATCH — sazby technikovi nastavuje firma na webu (Nastavení → Uživatelé), z appky je měnit nejde
export async function PATCH(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr
  return NextResponse.json({ error: 'Sazby ti nastavuje firma' }, { status: 403 })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
