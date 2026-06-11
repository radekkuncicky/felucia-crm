import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { unlink } from 'fs/promises'
import path from 'path'

export async function DELETE(req: NextRequest, { params }: { params: { id: string; photoId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const photo = await db.photo.findFirst({ where: { id: params.photoId, dealId: params.id, orgId } })
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const filePath = path.join(process.cwd(), 'public', photo.cesta)
    await unlink(filePath)
  } catch {
    // ignore file not found errors
  }

  await db.photo.delete({ where: { id: params.photoId } })
  return NextResponse.json({ ok: true })
}
