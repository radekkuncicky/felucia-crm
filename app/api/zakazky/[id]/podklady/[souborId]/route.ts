import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'
import { smazatPodkladSoubor } from '@/lib/zakazkaPodklady'

export async function DELETE(req: Request, { params }: { params: { id: string; souborId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).zakazkyEdit) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const dok = await db.zakázkaDokument.findFirst({
    where: { id: params.souborId, orgId, zakazkaId: params.id },
  })
  if (!dok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.zakázkaDokument.delete({ where: { id: params.souborId } })
  await smazatPodkladSoubor(dok.url)
  return NextResponse.json({ ok: true })
}
