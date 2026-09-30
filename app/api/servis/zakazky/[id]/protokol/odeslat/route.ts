import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { forbidden, getPerms, servisScopeWhere } from '@/lib/permissions'
import { odeslatServisniProtokol } from '@/lib/servisniProtokol'

/**
 * POST /api/servis/zakazky/[id]/protokol/odeslat — { to?, zprava? }
 * Pošle servisní protokol (PDF v příloze) klientovi. Výchozí adresa = e-mail klienta.
 * Jde i bez podpisu klienta; PDF pak nese stav „Nepodepsáno".
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })
  const scope = servisScopeWhere(getPerms(session.user), session.user.id)
  if (!scope) return forbidden()

  const body = await req.json().catch(() => ({}))
  const res = await odeslatServisniProtokol({
    orgId, plan, userId: session.user.id, id: params.id, scope, to: body.to, zprava: body.zprava,
  })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ ok: true, to: res.to, protokolOdeslan: res.protokolOdeslan })
}
