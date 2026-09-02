import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { logAction } from '@/lib/auditLog'
import { NextResponse } from 'next/server'
import { forbidden, getPerms } from '@/lib/permissions'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lead = await orgPrisma(session.user.orgId).lead.findFirst({
    where: { id: params.id, orgId: session.user.orgId },
    include: {
      assignedTo: { select: { id: true, jmeno: true, email: true, avatar: true } },
      notes: {
        include: { user: { select: { id: true, jmeno: true, avatar: true } } },
        orderBy: { vytvoreno: 'asc' },
      },
      prevedenNaOp: {
        select: {
          id: true,
          kod: true,
          predmet: true,
          stav: true,
          vytvoreno: true,
          client: { select: { id: true, jmeno: true, prijmeni: true } },
        },
      },
    },
  })

  if (!lead) return NextResponse.json({ error: 'Nenalezeno' }, { status: 404 })
  return NextResponse.json(lead)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).obchod) return forbidden()

  const lead = await orgPrisma(session.user.orgId).lead.findFirst({ where: { id: params.id, orgId: session.user.orgId } })
  if (!lead) return NextResponse.json({ error: 'Nenalezeno' }, { status: 404 })

  const body = await req.json()
  const allowedFields = ['jmeno', 'email', 'telefon', 'firma', 'zprava', 'status', 'assignedToId', 'odhadovanaHodnota', 'tagy']
  const data: Record<string, unknown> = {}
  for (const f of allowedFields) {
    if (f in body) data[f] = body[f]
  }
  if ('odhadovanaHodnota' in data && data.odhadovanaHodnota !== null) {
    data.odhadovanaHodnota = parseFloat(data.odhadovanaHodnota as string)
  }
  // Koncové stavy mají vlastní endpointy (/convert, /cancel), které doplní vazbu
  // na OP resp. důvod zamítnutí. Přes PATCH by vznikl status bez podkladu.
  if (data.status === 'PREVEDEN') {
    return NextResponse.json({ error: 'Lead se převádí přes „Převést na OP".' }, { status: 400 })
  }
  if (data.status === 'ZRUSEN') {
    return NextResponse.json({ error: 'Lead se zamítá přes „Zamítnout".' }, { status: 400 })
  }
  // Zpět z koncového stavu do pipeline (znovuotevření) řeší reopen endpoint.
  if (lead.status === 'PREVEDEN' || lead.status === 'ZRUSEN') {
    if ('status' in data) {
      return NextResponse.json({ error: 'Uzavřený lead nejde vrátit do pipeline.' }, { status: 400 })
    }
  }

  const updated = await orgPrisma(session.user.orgId).lead.update({
    where: { id: params.id },
    data,
    include: { assignedTo: { select: { id: true, jmeno: true, email: true, avatar: true } } },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).obchodMazani) return forbidden('Nemáte oprávnění mazat leady.')

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const lead = await db.lead.findFirst({ where: { id: params.id, orgId } })
  if (!lead) return NextResponse.json({ error: 'Nenalezeno' }, { status: 404 })

  await logAction({
    orgId,
    userId: session.user.id,
    typAkce: 'DELETE',
    typZaznamu: 'Lead',
    zaznamId: params.id,
    zaznamNazev: lead.jmeno,
  })

  // Poznámky odejdou cascade; případný převedený OP a klient zůstávají.
  await db.lead.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true })
}
