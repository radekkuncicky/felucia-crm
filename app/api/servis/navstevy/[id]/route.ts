// DEPRECATED alias nad /api/servis/zakazky/[id]. Mapuje vstup/výstup na starý
// tvar kvůli mobilní app. TODO(servis-refactor): odstranit po nasazení nové app.
import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { updateServisniZakazka, createServisniZakazka } from '@/lib/servisZakazkaService'
import { legacyStavToNew, toLegacyNavsteva } from '@/lib/servisLegacy'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const body = await req.json()
  if (body.stav) body.stav = legacyStavToNew(body.stav) ?? undefined

  const res = await updateServisniZakazka(orgId, params.id, body)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json(toLegacyNavsteva(res.data as never))
}

// POST /api/servis/navstevy/[kontraktId] - ruční návštěva ke kontraktu.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const body = await req.json()
  const res = await createServisniZakazka(orgId, { ...body, kontraktId: params.id })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json(toLegacyNavsteva(res.data as never), { status: 201 })
}
