import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'
import { kandidatKlientaLeadu, prevedLead } from '@/lib/leadPrevod'

// GET — kandidát na existujícího klienta (shoda telefonu/e-mailu, bez kontaktu podle jména/firmy),
// aby převod nezakládal duplicitu. -> { kandidat: { id, nazev, telefon, email, duvod } | null }
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).obchod) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const lead = await db.lead.findFirst({ where: { id: params.id, orgId } })
  if (!lead) return NextResponse.json({ error: 'Lead nenalezen.' }, { status: 404 })
  return NextResponse.json({ kandidat: await kandidatKlientaLeadu(db, orgId, lead) })
}

// POST { technologie?, predmet?, typKlienta?, existingClientId? } → { dealId, clientId, kod }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).obchod) return forbidden()

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Neplatná data požadavku.' }, { status: 400 })
  }

  const orgId = session.user.orgId
  const r = await prevedLead(orgPrisma(orgId), orgId, session.user.id, params.id, body)
  if (!r.ok) return NextResponse.json({ error: r.error, ...(r.upgradeUrl ? { upgradeUrl: r.upgradeUrl } : {}) }, { status: r.status })
  return NextResponse.json({ dealId: r.dealId, clientId: r.clientId, kod: r.kod }, { status: 201 })
}
