import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getPlanLimits } from '@/lib/planLimits'
import {
  getMobileOrWebSession,
  requireTechnikOrAdmin,
  canAccessServisniZakazka,
} from '@/lib/mobile-helpers'

// POST /api/mobile/servis/zakazky/[id]/foto - technik nahraje fotku zásahu.
// Fotky se ukládají jako data URL v Json poli (shodně s webem).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr
  if (!getPlanLimits(session!.user.plan).hasServiceModule) {
    return NextResponse.json({ error: 'Servisní modul není v plánu' }, { status: 403 })
  }
  if (!(await canAccessServisniZakazka(session!, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { orgId } = session!.user
  const db = orgPrisma(orgId)
  const zakazka = await db.servisniZakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const existing = (zakazka.fotky as string[]) ?? []
  if (existing.length >= 10) {
    return NextResponse.json({ error: 'Maximum 10 fotek na zakázku' }, { status: 400 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Soubor chybí' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Soubor je příliš velký (max 5 MB)' }, { status: 400 })
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  const dataUrl = `data:${file.type};base64,${base64}`

  const updated = await db.servisniZakazka.update({
    where: { id: params.id },
    data: { fotky: [...existing, dataUrl] },
  })

  return NextResponse.json({ fotky: updated.fotky })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
