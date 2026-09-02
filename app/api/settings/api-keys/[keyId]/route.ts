import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { getPerms } from '@/lib/permissions'

export async function PATCH(req: NextRequest, { params }: { params: { keyId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).nastaveniOrg) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof body.nazev === 'string') data.nazev = body.nazev.trim().slice(0, 100)
  if (typeof body.allowedOrigins === 'string') data.allowedOrigins = body.allowedOrigins.trim() || null
  if (typeof body.aktivni === 'boolean') data.aktivni = body.aktivni

  const key = await db.apiKey.updateMany({ where: { id: params.keyId, orgId }, data })
  return NextResponse.json({ ok: true, count: key.count })
}

export async function DELETE(req: NextRequest, { params }: { params: { keyId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).nastaveniOrg) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  await db.apiKey.deleteMany({ where: { id: params.keyId, orgId } })
  return NextResponse.json({ ok: true })
}
