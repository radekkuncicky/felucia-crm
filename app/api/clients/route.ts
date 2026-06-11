import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMobileSession } from '@/lib/mobile-auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { logAction } from '@/lib/auditLog'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions) ?? await getMobileSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''

  const clients = await orgPrisma(orgId).client.findMany({
    where: {
      ...(search ? {
        OR: [
          { jmeno: { contains: search, mode: 'insensitive' } },
          { prijmeni: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { telefon: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    },
    select: { id: true, jmeno: true, prijmeni: true, email: true, telefon: true },
    orderBy: { vytvoreno: 'desc' },
    take: 20,
  })

  return NextResponse.json(clients)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions) ?? await getMobileSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const body = await req.json()
  const { jmeno, prijmeni, telefon, email, ulice, mesto, psc, ico, dic, poznamka, typKlienta } = body

  if (!jmeno) {
    return NextResponse.json({ error: 'Jméno je povinné' }, { status: 400 })
  }

  const client = await orgPrisma(orgId).client.create({
    data: {
      orgId,
      typKlienta: typKlienta === 'FIRMA' ? 'FIRMA' : 'FYZICKA_OSOBA',
      jmeno,
      prijmeni: prijmeni || '',
      telefon: telefon || null,
      email: email || null,
      ulice: ulice || null,
      mesto: mesto || null,
      psc: psc || null,
      ico: ico || null,
      dic: dic || null,
      poznamka: poznamka || null,
    },
  })

  await logAction({
    orgId,
    userId: session.user.id,
    typAkce: 'CREATE',
    typZaznamu: 'Client',
    zaznamId: client.id,
    zaznamNazev: typKlienta === 'FIRMA' ? client.jmeno : `${client.jmeno} ${client.prijmeni}`.trim(),
    zmeny: { jmeno, prijmeni: prijmeni || null, telefon: telefon || null, email: email || null },
  })

  return NextResponse.json(client, { status: 201 })
}
