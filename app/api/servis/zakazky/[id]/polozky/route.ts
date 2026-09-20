import { getPlanLimits } from '@/lib/planLimits'
import { canAccessServisniZakazkaWeb } from '@/lib/zakazkyHelpers'
import { forbidden, getPerms } from '@/lib/permissions'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { listPolozky, replacePolozky } from '@/lib/servisVyuctovani'

// GET /api/servis/zakazky/[id]/polozky - položky vyúčtování + součty.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const res = await listPolozky(orgId, params.id)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json(res.data)
}

// PUT /api/servis/zakazky/[id]/polozky - nahradí celý seznam položek.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessServisniZakazkaWeb(session.user, getPerms(session.user), params.id))) return forbidden()
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const items = Array.isArray(body) ? body : body?.polozky
  const res = await replacePolozky(orgId, params.id, items)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json(res.data)
}
