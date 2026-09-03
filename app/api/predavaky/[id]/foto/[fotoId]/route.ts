import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { canEditPredavak } from '@/lib/zakazkyHelpers'
import { getPerms, forbidden } from '@/lib/permissions'

export async function DELETE(req: Request, { params }: { params: { id: string; fotoId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const predavak = await db.predavak.findFirst({ where: { id: params.id, orgId } })
  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!canEditPredavak(session.user, getPerms(session.user), predavak)) return forbidden()

  await db.predavakFoto.deleteMany({
    where: { id: params.fotoId, predavakId: params.id },
  })

  return NextResponse.json({ ok: true })
}
