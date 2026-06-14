import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, canAccessZakazka } from '@/lib/mobile-helpers'

export async function DELETE(req: Request, { params }: { params: { id: string; kontaktId: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  if (!(await canAccessZakazka(session!, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = orgPrisma(session!.user.orgId)
  const existing = await db.zakazkaKontakt.findFirst({ where: { id: params.kontaktId, zakazkaId: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.zakazkaKontakt.delete({ where: { id: params.kontaktId } })
  return NextResponse.json({ ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
