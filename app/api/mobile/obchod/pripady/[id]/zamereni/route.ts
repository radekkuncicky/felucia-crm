import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin, klientAdresa } from '@/lib/mobile-helpers'
import { getAktivniDefinice } from '@/lib/zamereniDefinice'
import { Technologie } from '@prisma/client'

// GET /api/mobile/obchod/pripady/[id]/zamereni — zaměření na případu
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const db = orgPrisma(session!.user.orgId)
  const deal = await db.deal.findFirst({ where: { id: params.id }, select: { id: true } })
  if (!deal) return NextResponse.json({ error: 'Případ nenalezen' }, { status: 404 })

  const zamereni = await db.zamereni.findMany({
    where: { dealId: params.id },
    include: { fotky: { select: { id: true, tag: true } }, autor: { select: { id: true, jmeno: true } } },
    orderBy: { vytvoreno: 'desc' },
  })

  return NextResponse.json(
    zamereni.map(z => ({
      id: z.id,
      typ: z.typ,
      stav: z.stav,
      datum: z.datum,
      pocetFotek: z.fotky.length,
      autor: z.autor ? { id: z.autor.id, jmeno: z.autor.jmeno } : null,
    })),
  )
}

// POST /api/mobile/obchod/pripady/[id]/zamereni — nové zaměření
// { typ?, datum?, gpsLat?, gpsLng? } — typ default podle technologie OP
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)
  const deal = await db.deal.findFirst({
    where: { id: params.id },
    include: { client: { select: { ulice: true, mesto: true, psc: true } } },
  })
  if (!deal) return NextResponse.json({ error: 'Případ nenalezen' }, { status: 404 })

  const body = await req.json().catch(() => ({})) as {
    typ?: string; datum?: string; gpsLat?: number; gpsLng?: number
  }

  const typ = (body.typ && Object.values(Technologie).includes(body.typ as Technologie)
    ? body.typ
    : deal.technologie) as Technologie

  const definice = await getAktivniDefinice(db, typ)

  const zamereni = await db.zamereni.create({
    data: {
      orgId,
      dealId: deal.id,
      autorId: userId,
      typ,
      datum: body.datum ? new Date(body.datum) : new Date(),
      gpsLat: typeof body.gpsLat === 'number' ? body.gpsLat : null,
      gpsLng: typeof body.gpsLng === 'number' ? body.gpsLng : null,
      definiceId: definice.id,
      definiceVerze: definice.verze,
      // Adresu předvyplníme z OP / klienta, ať ji obchodník jen potvrdí
      odpovedi: { adresa: deal.adresaDila || klientAdresa(deal.client) || '' },
    },
  })

  return NextResponse.json({ id: zamereni.id, typ, definice }, { status: 201 })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
