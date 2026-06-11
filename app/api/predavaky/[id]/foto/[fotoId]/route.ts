import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function DELETE(req: Request, { params }: { params: { id: string; fotoId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const predavak = await prisma.predavak.findFirst({ where: { id: params.id, orgId } })
  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.user.role === 'TECHNIK' && predavak.technikId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.predavakFoto.deleteMany({
    where: { id: params.fotoId, predavakId: params.id },
  })

  return NextResponse.json({ ok: true })
}
