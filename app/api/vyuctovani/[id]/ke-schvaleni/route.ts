import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const v = await db.vyuctovani.findFirst({
    where: { id: params.id, orgId },
    include: { zakazka: { select: { vedouciId: true, cislo: true } } },
  })
  if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (v.stav !== 'NAVRH') return NextResponse.json({ error: 'Lze odeslat pouze návrh' }, { status: 422 })

  await db.$transaction([
    db.vyuctovani.update({ where: { id: params.id }, data: { stav: 'KE_SCHVALENI' } }),
    ...(v.zakazka.vedouciId && v.zakazka.vedouciId !== session.user.id ? [
      db.notification.create({
        data: {
          orgId,
          userId: v.zakazka.vedouciId,
          typ: 'VYUCTOVANI_KE_SCHVALENI',
          zprava: `Vyúčtování ${v.cislo} čeká na schválení`,
          url: `/zakazky/${v.zakazkaId}?tab=vyuctovani`,
        },
      }),
    ] : []),
  ])

  return NextResponse.json({ ok: true })
}
