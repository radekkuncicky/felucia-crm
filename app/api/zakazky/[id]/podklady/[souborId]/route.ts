import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function DELETE(req: Request, { params }: { params: { id: string; souborId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const dok = await prisma.zakázkaDokument.findFirst({
    where: { id: params.souborId, orgId, zakazkaId: params.id },
  })
  if (!dok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.zakázkaDokument.delete({ where: { id: params.souborId } })
  return NextResponse.json({ ok: true })
}
