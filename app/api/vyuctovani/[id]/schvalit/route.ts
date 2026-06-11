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
    include: { zakazka: { select: { id: true, stav: true, vedouciId: true, cislo: true } } },
  })
  if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (v.stav !== 'KE_SCHVALENI') return NextResponse.json({ error: 'Lze schválit pouze vyúčtování ke schválení' }, { status: 422 })

  const stavOrder = ['NOVA', 'PRIRAZENA', 'V_REALIZACI', 'PREDANA', 'VYUCTOVANA', 'HOTOVO']
  const currentIdx = stavOrder.indexOf(v.zakazka.stav)
  const vyuctoIdx = stavOrder.indexOf('VYUCTOVANA')

  await db.$transaction([
    db.vyuctovani.update({
      where: { id: params.id },
      data: { stav: 'SCHVALENO', schvaleno: new Date(), schvalenoId: session.user.id },
    }),
    ...(currentIdx < vyuctoIdx ? [
      db.zakazka.update({
        where: { id: v.zakazkaId },
        data: { stav: 'VYUCTOVANA' },
      }),
    ] : []),
    ...(v.zakazka.vedouciId ? [
      db.notification.create({
        data: {
          orgId,
          userId: v.zakazka.vedouciId,
          typ: 'VYUCTOVANI_SCHVALENO',
          zprava: `Vyúčtování ${v.cislo} bylo schváleno`,
          url: `/zakazky/${v.zakazkaId}?tab=vyuctovani`,
        },
      }),
    ] : []),
    db.auditLog.create({
      data: {
        orgId,
        userId: session.user.id,
        typAkce: 'UPDATE',
        typZaznamu: 'Vyuctovani',
        zaznamId: params.id,
        zaznamNazev: v.cislo,
        zmeny: { stavPred: 'KE_SCHVALENI', stavPo: 'SCHVALENO' },
      },
    }),
  ])

  return NextResponse.json({ ok: true, zakazkaNovyStav: currentIdx < vyuctoIdx ? 'VYUCTOVANA' : null })
}
