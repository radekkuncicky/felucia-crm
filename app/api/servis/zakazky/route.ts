import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { listServisniZakazky, createServisniZakazka } from '@/lib/servisZakazkaService'

// GET /api/servis/zakazky - seznam servisních zakázek (nový tvar).
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const zakazky = await listServisniZakazky(orgId, {
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    stav: searchParams.get('stav'),
  })
  return NextResponse.json(zakazky)
}

// POST /api/servis/zakazky - nová servisní zakázka (plánovaná i ruční).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const body = await req.json()
  const res = await createServisniZakazka(orgId, body)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json(res.data, { status: 201 })
}
