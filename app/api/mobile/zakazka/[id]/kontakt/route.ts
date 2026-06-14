import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, canAccessZakazka } from '@/lib/mobile-helpers'
import { parseKontaktInput } from '@/lib/zakazkaKontakt'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  if (!(await canAccessZakazka(session!, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = parseKontaktInput(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const kontakt = await orgPrisma(session!.user.orgId).zakazkaKontakt.create({
    data: { orgId: session!.user.orgId, zakazkaId: params.id, vytvorilId: session!.user.id, ...parsed.data },
  })

  return NextResponse.json(kontakt, { status: 201 })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
