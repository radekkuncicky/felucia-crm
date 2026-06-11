import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, canAccessZakazka } from '@/lib/mobile-helpers'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; polozkaId: string } },
) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  if (!(await canAccessZakazka(session!, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { hotovo?: boolean }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (typeof body.hotovo !== 'boolean') {
    return NextResponse.json({ error: 'Pole hotovo musí být boolean' }, { status: 400 })
  }

  // Verify polozka belongs to this zakázka
  const polozka = await orgPrisma(session!.user.orgId).zakazkaPolozka.findFirst({
    where: { id: params.polozkaId, zakazkaId: params.id },
  })
  if (!polozka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await orgPrisma(session!.user.orgId).zakazkaPolozka.update({
    where: { id: params.polozkaId },
    data: { hotovo: body.hotovo },
    select: { id: true, nazev: true, hotovo: true, stav: true, mnozstvi: true, jednotka: true },
  })

  return NextResponse.json({
    id: updated.id,
    nazev: updated.nazev,
    hotovo: updated.hotovo,
    stav: updated.stav,
    mnozstvi: Number(updated.mnozstvi),
    jednotka: updated.jednotka,
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
