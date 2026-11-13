import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin } from '@/lib/mobile-helpers'
import { signVykazPdfUrl } from '@/lib/vykazPrace'

// POST /api/mobile/vykaz/pdf-odkaz { fakturaceId } → { url } (relativní, platí 10 min)
// Appka otevírá PDF v systémovém prohlížeči, který Bearer token nemá — proto podepsaný odkaz.
export async function POST(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  let body: { fakturaceId?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const fakturaceId = typeof body?.fakturaceId === 'string' ? body.fakturaceId : ''
  if (!fakturaceId) return NextResponse.json({ error: 'Chybí fakturace' }, { status: 400 })

  const { orgId, id: userId } = session!.user
  const f = await orgPrisma(orgId).vykazFakturace.findFirst({ where: { id: fakturaceId, orgId, userId }, select: { id: true } })
  if (!f) return NextResponse.json({ error: 'Fakturace nenalezena' }, { status: 404 })

  return NextResponse.json({ url: signVykazPdfUrl(userId, f.id) })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
