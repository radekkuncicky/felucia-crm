import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'

// DELETE — odebere technika z etapy; na zakázce zůstává (přístup k předávákům, fotkám)
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; etapaId: string; technikId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).zakazkyEdit) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const etapa = await db.zakazkaEtapa.findFirst({ where: { id: params.etapaId, zakazkaId: params.id, orgId }, select: { id: true } })
  if (!etapa) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.etapaTechnik.deleteMany({ where: { etapaId: etapa.id, technikId: params.technikId } })

  return new NextResponse(null, { status: 204 })
}
