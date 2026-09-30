import { NextResponse } from 'next/server'
import { getPlanLimits } from '@/lib/planLimits'
import { getPerms, servisScopeWhere } from '@/lib/permissions'
import { getMobileOrWebSession, requireTechnikOrAdmin } from '@/lib/mobile-helpers'
import { odeslatServisniProtokol } from '@/lib/servisniProtokol'

// POST /api/mobile/servis/zakazky/[id]/protokol/odeslat — { to?, zprava? }
// Technik pošle protokol klientovi z telefonu (výchozí adresa = e-mail klienta).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr
  const { orgId, plan, id: userId } = session!.user
  if (!getPlanLimits(plan).hasServiceModule) {
    return NextResponse.json({ error: 'Servisní modul není v plánu' }, { status: 403 })
  }
  const scope = servisScopeWhere(getPerms(session!.user), userId)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const res = await odeslatServisniProtokol({ orgId, plan, userId, id: params.id, scope, to: body.to, zprava: body.zprava })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ ok: true, to: res.to, protokolOdeslan: res.protokolOdeslan })
}
