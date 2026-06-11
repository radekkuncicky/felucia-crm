import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function DELETE(req: Request, { params }: { params: { id: string; fotoId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const predavak = await db.predavak.findFirst({ where: { id: params.id, orgId } })
  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.user.role === 'TECHNIK' && predavak.technikId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.predavakFoto.deleteMany({
    where: { id: params.fotoId, predavakId: params.id },
  })

  return NextResponse.json({ ok: true })
}
