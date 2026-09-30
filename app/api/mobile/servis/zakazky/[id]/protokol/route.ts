import { NextResponse } from 'next/server'
import { getPlanLimits } from '@/lib/planLimits'
import { getPerms, servisScopeWhere } from '@/lib/permissions'
import { getMobileOrWebSession, requireTechnikOrAdmin } from '@/lib/mobile-helpers'
import { renderServisniProtokol } from '@/lib/servisniProtokol'

// GET /api/mobile/servis/zakazky/[id]/protokol - servisní protokol jako PDF (i bez podpisu klienta).
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr
  const { orgId, plan, id: userId } = session!.user
  if (!getPlanLimits(plan).hasServiceModule) {
    return NextResponse.json({ error: 'Servisní modul není v plánu' }, { status: 403 })
  }
  const scope = servisScopeWhere(getPerms(session!.user), userId)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const res = await renderServisniProtokol(orgId, plan, params.id, scope)
    if (!res) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return new Response(res.pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${res.filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('[mobile] Protokol PDF error:', err)
    return NextResponse.json({ error: 'Chyba při generování PDF.' }, { status: 500 })
  }
}
