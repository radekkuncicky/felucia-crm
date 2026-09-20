import { getServerSession } from 'next-auth'
import { safeUploadPath } from '@/lib/uploadSafety'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { unlink } from 'fs/promises'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = session.user
  const db = orgPrisma(orgId)

  const doc = await db.document.findFirst({
    where: { id: params.id, orgId },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const filePath = safeUploadPath(doc.cesta, `/uploads/${orgId}/`)
  if (filePath) await unlink(filePath).catch(() => { /* soubor už chybí — smažeme jen záznam */ })

  await db.document.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true })
}
