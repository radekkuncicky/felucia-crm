import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const template = await prisma.quoteTemplate.findFirst({
    where: { id: params.id, orgId },
  })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.$transaction([
    prisma.quoteTemplate.updateMany({
      where: { orgId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.quoteTemplate.update({
      where: { id: params.id },
      data: { isDefault: true },
    }),
  ])

  return NextResponse.json({ ok: true })
}
