import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { forbidden, getPerms, servisScopeWhere } from '@/lib/permissions'
import { renderServisniProtokol } from '@/lib/servisniProtokol'

// GET /api/servis/zakazky/[id]/protokol - servisní protokol jako PDF (hardened cesta).
// Jde stáhnout kdykoliv, i bez podpisu klienta (PDF pak nese stav „Nepodepsáno"/„Koncept").
// ?inline=1 = náhled v prohlížeči, jinak stažení souboru.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })
  const scope = servisScopeWhere(getPerms(session.user), session.user.id)
  if (!scope) return forbidden()

  try {
    const res = await renderServisniProtokol(orgId, plan, params.id, scope)
    if (!res) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const inline = new URL(req.url).searchParams.get('inline') === '1'
    return new Response(res.pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${res.filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('Protokol PDF error:', err)
    return NextResponse.json({ error: 'Chyba při generování PDF.' }, { status: 500 })
  }
}
