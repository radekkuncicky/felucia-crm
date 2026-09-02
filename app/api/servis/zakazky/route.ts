import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { listServisniZakazky, createServisniZakazka } from '@/lib/servisZakazkaService'
import { getPerms, forbidden, servisScopeWhere } from '@/lib/permissions'

// GET /api/servis/zakazky - seznam servisních zakázek (nový tvar).
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const scope = servisScopeWhere(getPerms(session.user), session.user.id)
  if (!scope) return forbidden()

  const { searchParams } = new URL(req.url)
  const zakazky = await listServisniZakazky(orgId, {
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    stav: searchParams.get('stav'),
    scope,
  })
  return NextResponse.json(zakazky)
}

// POST /api/servis/zakazky - nová servisní zakázka (plánovaná i ruční).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })
  if (!getPerms(session.user).servisDispecink) return forbidden()

  const body = await req.json()
  const res = await createServisniZakazka(orgId, body)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json(res.data, { status: 201 })
}
