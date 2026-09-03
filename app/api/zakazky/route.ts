import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { generateZakazkaCislo, polozkyZAktivniNabidky } from '@/lib/zakazkaWorkflow'
import { userHasPerm } from '@/lib/zakazkyHelpers'
import { getPerms, forbidden, zakazkyScopeWhere } from '@/lib/permissions'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const { searchParams } = new URL(req.url)
  const stav = searchParams.get('stav')
  const search = searchParams.get('search')
  const vedouciId = searchParams.get('vedouciId')

  const scope = zakazkyScopeWhere(getPerms(session.user), session.user.id)
  if (scope === null) return forbidden()

  const typ = searchParams.get('typ')

  // scope (PRIRAZENE) používá OR, proto jde do AND, aby ho search nepřepsal
  const where: Record<string, unknown> = { orgId, AND: [scope] }
  if (stav) where.stav = stav
  if (vedouciId) where.vedouciId = vedouciId
  if (typ) where.typ = typ
  if (search) {
    where.OR = [
      { cislo: { contains: search, mode: 'insensitive' } },
      { nazev: { contains: search, mode: 'insensitive' } },
    ]
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
  if (!getPerms(session.user).zakazkyEdit) return forbidden()

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
    if (!(await userHasPerm(orgId, body.vedouciId, 'zakazkySchvalovani'))) {
      return NextResponse.json({ error: 'Vedoucí nenalezen nebo nemá oprávnění schvalovat' }, { status: 400 })
    }
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
      vedouciId: body.vedouciId ?? (getPerms(session.user).zakazkySchvalovani ? session.user.id : null),
      opId: body.opId ?? null,
      poznamka: body.poznamka ?? null,
      polozky: polozkyFromQuote.length > 0 ? { create: polozkyFromQuote } : undefined,
    },
  })

  return NextResponse.json(zakazka, { status: 201 })
}
