import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'
import { forbidden, getPerms } from '@/lib/permissions'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  if (!(await canAccessZakazka(session.user, getPerms(session.user), params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const zakazka = await db.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'Chybí URL' }, { status: 400 })

  const updated = await db.zakazka.update({
    where: { id: params.id },
    data: { titulniFotoUrl: url },
    select: { titulniFotoUrl: true },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  if (!getPerms(session.user).zakazkyEdit) return forbidden()

  const zakazka = await db.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.zakazka.update({
    where: { id: params.id },
    data: { titulniFotoUrl: null },
  })

  return NextResponse.json({ ok: true })
}
