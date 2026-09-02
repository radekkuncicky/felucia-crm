import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).zakazkySchvalovani) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const v = await db.vyuctovani.findFirst({
    where: { id: params.id, orgId },
    include: { zakazka: { select: { id: true, stav: true, vedouciId: true, cislo: true } } },
  })
  if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Idempotent: už schválené vyúčtování → úspěch (poražený v souběhu dvou kliků sem spadne)
  if (v.stav === 'SCHVALENO') return NextResponse.json({ ok: true, alreadyApproved: true, zakazkaNovyStav: null })
  // Manažer smí schválit i rovnou z návrhu (mezistav KE_SCHVALENI má smysl jen při předávce mezi lidmi)
  if (v.stav !== 'KE_SCHVALENI' && v.stav !== 'NAVRH') {
    return NextResponse.json({ error: 'Vyúčtování nelze v tomto stavu schválit' }, { status: 422 })
  }

  const stavOrder = ['NOVA', 'PRIRAZENA', 'V_REALIZACI', 'PREDANA', 'VYUCTOVANA', 'HOTOVO']
  const currentIdx = stavOrder.indexOf(v.zakazka.stav)
  const vyuctoIdx = stavOrder.indexOf('VYUCTOVANA')
  const posunZakazku = currentIdx < vyuctoIdx

  let raced = false

  await db.$transaction(async tx => {
    // Concurrency guard: jen request, který překlopí NAVRH/KE_SCHVALENI→SCHVALENO, pokračuje
    const flip = await tx.vyuctovani.updateMany({
      where: { id: params.id, stav: { in: ['NAVRH', 'KE_SCHVALENI'] } },
      data: { stav: 'SCHVALENO', schvaleno: new Date(), schvalenoId: session.user.id },
    })
    if (flip.count !== 1) {
      raced = true
      return
    }

    if (posunZakazku) {
      await tx.zakazka.update({
        where: { id: v.zakazkaId },
        data: { stav: 'VYUCTOVANA' },
      })
    }

    // Audit log — záznam o akci, zůstává awaitovaný v transakci
    await tx.auditLog.create({
      data: {
        orgId,
        userId: session.user.id,
        typAkce: 'UPDATE',
        typZaznamu: 'Vyuctovani',
        zaznamId: params.id,
        zaznamNazev: v.cislo,
        zmeny: { stavPred: v.stav, stavPo: 'SCHVALENO' },
      },
    })
  })

  if (raced) return NextResponse.json({ ok: true, alreadyApproved: true, zakazkaNovyStav: null })

  // Notifikace fire-and-forget — response hned po commitu (aktérovi akce se neposílá)
  if (v.zakazka.vedouciId && v.zakazka.vedouciId !== session.user.id) {
    void db.notification.create({
      data: {
        orgId,
        userId: v.zakazka.vedouciId,
        typ: 'VYUCTOVANI_SCHVALENO',
        zprava: `Vyúčtování ${v.cislo} bylo schváleno`,
        url: `/zakazky/${v.zakazkaId}?tab=vyuctovani`,
      },
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, zakazkaNovyStav: posunZakazku ? 'VYUCTOVANA' : null })
}
