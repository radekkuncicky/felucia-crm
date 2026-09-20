import { getServerSession } from 'next-auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { sanitizeFullDocumentHtml } from '@/lib/sanitizeHtml'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).nastaveniOrg) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const body = await req.json()
  const data: Record<string, string | null> = {}
  if (typeof body.nazev === 'string') data.nazev = body.nazev
  if (typeof body.popis === 'string') data.popis = body.popis.trim() || null
  if (typeof body.obsah === 'string') data.obsah = sanitizeFullDocumentHtml(body.obsah)
  if (typeof body.typSablony === 'string') data.typSablony = body.typSablony

  const tpl = await db.contractTemplate.updateMany({
    where: { id: params.id, orgId },
    data,
  })
  if (tpl.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).nastaveniOrg) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  await db.contractTemplate.deleteMany({ where: { id: params.id, orgId } })
  return NextResponse.json({ ok: true })
}
