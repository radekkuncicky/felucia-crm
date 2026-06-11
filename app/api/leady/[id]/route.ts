import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

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
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

  const updated = await orgPrisma(session.user.orgId).lead.update({ where: { id: params.id }, data })
  return NextResponse.json(updated)
}
