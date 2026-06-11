import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lead = await orgPrisma(session.user.orgId).lead.findFirst({ where: { id: params.id, orgId: session.user.orgId } })
  if (!lead) return NextResponse.json({ error: 'Nenalezeno' }, { status: 404 })

  const { text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: 'Text poznámky je povinný.' }, { status: 400 })

  const note = await orgPrisma(session.user.orgId).leadNote.create({
    data: { leadId: params.id, userId: session.user.id, text: text.trim() },
    include: { user: { select: { id: true, jmeno: true, avatar: true } } },
  })

  return NextResponse.json(note, { status: 201 })
}
