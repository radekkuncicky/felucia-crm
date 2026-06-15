import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { generateZakazkaCislo, polozkyZAktivniNabidky } from '@/lib/zakazkaWorkflow'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const { searchParams } = new URL(req.url)
  const stav = searchParams.get('stav')
  const search = searchParams.get('search')
  const vedouciId = searchParams.get('vedouciId')

  const isTechnik = session.user.role === 'TECHNIK'

  const typ = searchParams.get('typ')

  const where: Record<string, unknown> = { orgId }
  if (stav) where.stav = stav
  if (vedouciId) where.vedouciId = vedouciId
  if (typ) where.typ = typ
  if (search) {
    where.OR = [
      { cislo: { contains: search, mode: 'insensitive' } },
      { nazev: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (isTechnik) {
    where.techniciRel = { some: { technikId: session.user.id } }
  }

  const zakazky = await db.zakazka.findMany({
    where,
    include: {
      klient: { select: { id: true, jmeno: true, prijmeni: true } },
      vedouci: { select: { id: true, jmeno: true, email: true } },
      techniciRel: { include: { technik: { select: { id: true, jmeno: true, email: true } } } },
      _count: { select: { predavaky: true, polozky: true } },
    },
    orderBy: { vytvoreno: 'desc' },
  })

  return NextResponse.json(zakazky)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const body = await req.json()

  let opKod: string | null = null
  let opAdresaDila: string | null = null
  if (body.opId) {
    const op = await db.deal.findFirst({ where: { id: body.opId, orgId }, select: { kod: true, adresaDila: true } })
    opKod = op?.kod ?? null
    opAdresaDila = op?.adresaDila ?? null
  }
  const cislo = await generateZakazkaCislo(orgId, opKod)

  // Validate klientId belongs to this org
  if (!body.klientId) return NextResponse.json({ error: 'Chybí klientId' }, { status: 400 })
  const klient = await db.client.findFirst({ where: { id: body.klientId, orgId } })
  if (!klient) return NextResponse.json({ error: 'Klient nenalezen' }, { status: 400 })

  // Validate vedouciId (if explicitly provided) belongs to this org
  if (body.vedouciId) {
    const vedouci = await db.user.findFirst({ where: { id: body.vedouciId, orgId } })
    if (!vedouci) return NextResponse.json({ error: 'Vedoucí nenalezen' }, { status: 400 })
  }

  const polozkyFromQuote = body.opId ? await polozkyZAktivniNabidky(body.opId, orgId) : []

  const zakazka = await db.zakazka.create({
    data: {
      orgId,
      cislo,
      klientId: body.klientId,
      nazev: body.nazev,
      technologie: body.technologie ?? null,
      mistoStavby: body.mistoStavby ?? opAdresaDila ?? null,
      vedouciId: body.vedouciId ?? session.user.id,
      opId: body.opId ?? null,
      poznamka: body.poznamka ?? null,
      typ: body.typ === 'SERVISNI' ? 'SERVISNI' : 'OBCHODNI',
      polozky: polozkyFromQuote.length > 0 ? { create: polozkyFromQuote } : undefined,
    },
  })

  return NextResponse.json(zakazka, { status: 201 })
}
