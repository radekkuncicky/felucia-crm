import { NextRequest, NextResponse } from 'next/server'
import { canAccessDeal } from '@/lib/zakazkyHelpers'
import { forbidden, getPerms } from '@/lib/permissions'
import { safeUploadPath } from '@/lib/uploadSafety'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { unlink } from 'fs/promises'

export async function DELETE(req: NextRequest, { params }: { params: { id: string; photoId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessDeal(session.user, getPerms(session.user), params.id))) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const photo = await db.photo.findFirst({ where: { id: params.photoId, dealId: params.id, orgId } })
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const filePath = safeUploadPath(photo.cesta, `/uploads/${orgId}/`)
  if (filePath) await unlink(filePath).catch(() => { /* soubor už chybí */ })

  await db.photo.delete({ where: { id: params.photoId } })
  return NextResponse.json({ ok: true })
}
