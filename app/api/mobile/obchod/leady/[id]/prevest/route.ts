import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { kandidatKlientaLeadu, prevedLead } from '@/lib/leadPrevod'
import { logAction } from '@/lib/auditLog'

// GET /api/mobile/obchod/leady/[id]/prevest — kandidát na existujícího klienta (duplicita)
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr
  const { orgId } = session!.user
  const db = orgPrisma(orgId)
  const lead = await db.lead.findFirst({ where: { id: params.id, orgId } })
  if (!lead) return NextResponse.json({ error: 'Lead nenalezen' }, { status: 404 })
  return NextResponse.json({ kandidat: await kandidatKlientaLeadu(db, orgId, lead) })
}

// POST /api/mobile/obchod/leady/[id]/prevest { technologie?, predmet?, existingClientId? }
// → { dealId, clientId, kod } — OP dostane volající jako obchodník, aktivity leadu přejdou na OP.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr
  if (session!.user.plan === 'STARTER') return NextResponse.json({ error: 'Leady nejsou v tomto plánu.' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Neplatný požadavek' }, { status: 400 })

  const { orgId, id: userId } = session!.user
  const r = await prevedLead(orgPrisma(orgId), orgId, userId, params.id, body)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })

  await logAction({ orgId, userId, typAkce: 'CREATE', typZaznamu: 'Deal', zaznamId: r.dealId, zaznamNazev: `${r.kod} (z leadu, Felucia Sales)` })
  return NextResponse.json({ dealId: r.dealId, clientId: r.clientId, kod: r.kod }, { status: 201 })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
