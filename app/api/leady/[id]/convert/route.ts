import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

async function generateDealKod(orgId: string): Promise<string> {
  const yr = new Date().getFullYear()
  const yrShort = yr % 100
  const prefix = `OP-${yrShort.toString().padStart(2, '0')}-`
  const last = await prisma.deal.findFirst({
    where: { orgId, kod: { startsWith: prefix } },
    orderBy: { kod: 'desc' },
    select: { kod: true },
  })
  const lastNum = last?.kod ? parseInt(last.kod.replace(prefix, ''), 10) : 0
  return `${prefix}${(lastNum + 1).toString().padStart(3, '0')}`
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId

  const lead = await prisma.lead.findFirst({ where: { id: params.id, orgId } })
  if (!lead) return NextResponse.json({ error: 'Nenalezeno' }, { status: 404 })
  if (lead.status === 'PREVEDEN') return NextResponse.json({ error: 'Lead je již převeden.' }, { status: 400 })

  const body = await req.json()
  // body: { technologie, predmet?, typKlienta?, existingClientId? }

  const technologie = body.technologie || 'JINE'

  // Vytvoř klienta nebo použij existujícího
  let clientId: string
  if (body.existingClientId) {
    const existing = await prisma.client.findFirst({ where: { id: body.existingClientId, orgId } })
    if (!existing) return NextResponse.json({ error: 'Klient nenalezen.' }, { status: 404 })
    clientId = existing.id
  } else {
    // Rozděl jméno na jmeno + prijmeni
    const nameParts = lead.jmeno.trim().split(' ')
    const jmeno = nameParts[0] || lead.jmeno
    const prijmeni = nameParts.slice(1).join(' ') || ''

    const klient = await prisma.client.create({
      data: {
        orgId,
        typKlienta: lead.firma ? 'FIRMA' : (body.typKlienta || 'FYZICKA_OSOBA'),
        jmeno,
        prijmeni,
        email: lead.email || null,
        telefon: lead.telefon || null,
        poznamka: lead.zprava
          ? `Původní zpráva z leadu:\n${lead.zprava}`
          : null,
      },
    })
    clientId = klient.id
  }

  const kod = await generateDealKod(orgId)

  const deal = await prisma.deal.create({
    data: {
      orgId,
      clientId,
      userId: session.user.id,
      kod,
      technologie,
      stav: 'NOVY',
      predmet: body.predmet || lead.zprava?.slice(0, 100) || lead.jmeno,
    },
  })

  // Označení leadu jako převeden + vazba na OP a klienta
  await prisma.lead.update({
    where: { id: params.id },
    data: {
      status: 'PREVEDEN',
      prevedenNaOpId: deal.id,
      prevedenNaKlientId: clientId,
    },
  })

  return NextResponse.json({ dealId: deal.id, clientId, kod }, { status: 201 })
}
