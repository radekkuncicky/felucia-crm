import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = session.user

  const doc = await prisma.document.findFirst({
    where: { id: params.id, orgId },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const filePath = path.join(process.cwd(), 'public', doc.cesta)
  try {
    await unlink(filePath)
  } catch {
    // File may already be missing — proceed to delete DB record
  }

  await prisma.document.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true })
}
