import { getServerSession } from 'next-auth'
import { Prisma, Technologie } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { leadPredmet, sluzbaToTechnologie } from '@/lib/leadService'
import { generateDealKod } from '@/lib/dealKod'
import { createWithUniqueKod } from '@/lib/uniqueKod'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'

const TECHNOLOGIE_VALUES = new Set<string>(Object.values(Technologie))

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).obchod) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const lead = await db.lead.findFirst({ where: { id: params.id, orgId } })
  if (!lead) return NextResponse.json({ error: 'Lead nenalezen.' }, { status: 404 })
  if (lead.status === 'PREVEDEN') return NextResponse.json({ error: 'Lead je již převeden.' }, { status: 400 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Neplatná data požadavku.' }, { status: 400 })
  }
  // body: { technologie?, predmet?, typKlienta?, existingClientId? }

  if (body.technologie !== undefined && !TECHNOLOGIE_VALUES.has(body.technologie)) {
    return NextResponse.json({ error: `Neplatná technologie: ${body.technologie}` }, { status: 400 })
  }
  const technologie: Technologie = body.technologie || sluzbaToTechnologie(lead.sluzba)
  const predmet = typeof body.predmet === 'string' && body.predmet.trim()
    ? body.predmet.trim()
    : leadPredmet(lead)

  let clientId: string
  let createdNewClient = false

  if (body.existingClientId) {
    const existing = await db.client.findFirst({ where: { id: body.existingClientId, orgId }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Klient nenalezen.' }, { status: 404 })
    clientId = existing.id
  } else {
    if (!lead.jmeno?.trim()) {
      return NextResponse.json({ error: 'Lead nemá vyplněné jméno, klienta nelze založit.' }, { status: 400 })
    }
    // Rozděl jméno na jmeno + prijmeni
    const nameParts = lead.jmeno.trim().split(' ')
    const jmeno = nameParts[0] || lead.jmeno
    const prijmeni = nameParts.slice(1).join(' ') || ''

    const klient = await db.client.create({
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
    createdNewClient = true
  }

  // OP + přepnutí leadu jedním zápisem per pokus. Číslo OP (kod) může kolidovat
  // se souběžně vznikajícím OP jinde v appce (unique orgId+kod) — createWithUniqueKod
  // číslo přegeneruje a zkusí znovu v čerstvé transakci (dřívější kolize tu způsobovala
  // nespolehlivý převod, viz [[project-batch-tasks-2026-08-22]] úkol 4).
  try {
    const deal = await createWithUniqueKod(
      () => generateDealKod(orgId),
      (kod) => db.$transaction(async (tx) => {
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
        await tx.lead.update({
          where: { id: params.id },
          data: {
            status: 'PREVEDEN',
            prevedenNaOpId: deal.id,
            prevedenNaKlientId: clientId,
          },
        })
        return deal
      }),
    )

    return NextResponse.json({ dealId: deal.id, clientId, kod: deal.kod }, { status: 201 })
  } catch (e) {
    console.error(`[leady/convert] selhal převod leadu ${params.id} (org ${orgId}):`, e)
    // Nový klient bez vazby na OP by zůstal osiřelý — při definitivním selhání ho smažeme.
    if (createdNewClient) {
      await db.client.delete({ where: { id: clientId } }).catch(() => {})
    }
    const message = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
      ? 'Převod se nezdařil kvůli kolizi čísla OP, zkuste to prosím znovu.'
      : 'Převod se nezdařil kvůli neočekávané chybě, zkuste to prosím znovu nebo kontaktujte podporu.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
