import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { canEditPredavak } from '@/lib/zakazkyHelpers'
import { getPerms, forbidden } from '@/lib/permissions'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const predavak = await db.predavak.findFirst({
    where: { id: params.id, orgId },
    include: { polozky: true, zakazka: { include: { vedouci: true } } },
  })
  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only the technik of this predavak (or admin)
  if (!canEditPredavak(session.user, getPerms(session.user), predavak)) return forbidden()
  if (predavak.stav !== 'ROZPRACOVAN' && predavak.stav !== 'ODMITNUTO') {
    return NextResponse.json({ error: 'Protokol nelze odeslat v tomto stavu' }, { status: 422 })
  }

  const body = await req.json()
  const { podpisSvg, klientPritomen, poznamka } = body

  // Validation
  const zahrnuto = predavak.polozky.filter(p => p.zahrnuto)
  if (zahrnuto.length === 0) {
    return NextResponse.json({ error: 'Musí být zaškrtnuta aspoň 1 položka' }, { status: 422 })
  }
  if (klientPritomen && !podpisSvg) {
    return NextResponse.json({ error: 'Chybí podpis klienta' }, { status: 422 })
  }

  let zakazkaNovyStav: string | null = null
  await db.$transaction(async tx => {
    // Update predavak
    await tx.predavak.update({
      where: { id: params.id },
      data: {
        stav: 'PODPISAN',
        podpisano: new Date(),
        podpisSvg: podpisSvg ?? null,
        klientPritomen: klientPritomen ?? true,
        poznamka: poznamka ?? predavak.poznamka,
      },
    })

    // Move zakazka to PREDANA if not already past that
    const stavOrder = ['NOVA', 'PRIRAZENA', 'V_REALIZACI', 'PREDANA', 'VYUCTOVANA', 'HOTOVO']
    const currentIdx = stavOrder.indexOf(predavak.zakazka.stav)
    const predanaIdx = stavOrder.indexOf('PREDANA')
    if (currentIdx < predanaIdx) {
      await tx.zakazka.update({
        where: { id: predavak.zakazkaId },
        data: { stav: 'PREDANA' },
      })
      zakazkaNovyStav = 'PREDANA'
    }

    // Notify vedouci (ne když protokol odesílá sám vedoucí)
    const vedouciId = predavak.zakazka.vedouciId
    if (vedouciId && vedouciId !== session.user.id) {
      await tx.notification.create({
        data: {
          orgId,
          userId: vedouciId,
          typ: 'PREDAVAK_PODPISAN',
          zprava: `Předávací protokol ${predavak.cislo} čeká na schválení`,
          url: `/zakazky/${predavak.zakazkaId}?tab=predavaky`,
        },
      })
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        orgId,
        userId: session.user.id,
        typAkce: 'UPDATE',
        typZaznamu: 'Predavak',
        zaznamId: params.id,
        zaznamNazev: predavak.cislo,
        zmeny: { stavPred: predavak.stav, stavPo: 'PODPISAN' },
      },
    })
  })

  return NextResponse.json({ ok: true, zakazkaNovyStav })
}
