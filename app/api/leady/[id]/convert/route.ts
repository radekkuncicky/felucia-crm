import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { leadPredmet, sluzbaToTechnologie } from '@/lib/leadService'
import { NextResponse } from 'next/server'

async function generateDealKod(orgId: string): Promise<string> {
  const yr = new Date().getFullYear()
  const yrShort = yr % 100
  const prefix = `OP-${yrShort.toString().padStart(2, '0')}-`
  const last = await orgPrisma(orgId).deal.findFirst({
    where: { kod: { startsWith: prefix } },
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
  const db = orgPrisma(orgId)

  const lead = await db.lead.findFirst({ where: { id: params.id, orgId } })
  if (!lead) return NextResponse.json({ error: 'Nenalezeno' }, { status: 404 })
  if (lead.status === 'PREVEDEN') return NextResponse.json({ error: 'Lead je již převeden.' }, { status: 400 })

  const body = await req.json()
  // body: { technologie?, predmet?, typKlienta?, existingClientId? }

  const technologie = body.technologie || sluzbaToTechnologie(lead.sluzba)
  const predmet = typeof body.predmet === 'string' && body.predmet.trim()
    ? body.predmet.trim()
    : leadPredmet(lead)

  // Existujícího klienta ověř dřív, ať transakce níž řeší jen zápisy.
  if (body.existingClientId) {
    const existing = await db.client.findFirst({ where: { id: body.existingClientId, orgId }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Klient nenalezen.' }, { status: 404 })
  }

  const kod = await generateDealKod(orgId)

  // Klient + OP + přepnutí leadu jedním zápisem — jinak by při chybě uprostřed
  // zůstal viset klient nebo OP bez vazby na lead.
  const { dealId, clientId } = await db.$transaction(async (tx) => {
    let clientId: string
    if (body.existingClientId) {
      clientId = body.existingClientId as string
    } else {
      // Rozděl jméno na jmeno + prijmeni
      const nameParts = lead.jmeno.trim().split(' ')
      const jmeno = nameParts[0] || lead.jmeno
      const prijmeni = nameParts.slice(1).join(' ') || ''

      const klient = await tx.client.create({
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

    const deal = await tx.deal.create({
      data: {
        orgId,
        clientId,
        userId: session.user.id,
        kod,
        technologie,
        stav: 'NOVY',
        predmet,
      },
    })

    // Označení leadu jako převeden + vazba na OP a klienta
    await tx.lead.update({
      where: { id: params.id },
      data: {
        status: 'PREVEDEN',
        prevedenNaOpId: deal.id,
        prevedenNaKlientId: clientId,
      },
    })

    return { dealId: deal.id, clientId }
  })

  return NextResponse.json({ dealId, clientId, kod }, { status: 201 })
}
