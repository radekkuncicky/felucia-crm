import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, canAccessPredavak as canAccess } from '@/lib/mobile-helpers'

export async function POST(req: Request, { params }: { params: { predavakId: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  if (!(await canAccess(session!, params.predavakId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orgId = session!.user.orgId
  const db = orgPrisma(orgId)

  const predavak = await db.predavak.findFirst({
    where: { id: params.predavakId },
    include: {
      polozky: true,
      zakazka: { include: { vedouci: true } },
    },
  })
  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (predavak.stav !== 'ROZPRACOVAN' && predavak.stav !== 'ODMITNUTO') {
    return NextResponse.json({ error: 'Protokol nelze odeslat v tomto stavu' }, { status: 422 })
  }

  const zahrnuto = predavak.polozky.filter(p => p.zahrnuto)
  if (zahrnuto.length === 0) {
    return NextResponse.json({ error: 'Musí být zaškrtnuta aspoň 1 položka' }, { status: 422 })
  }

  const body = await req.json()
  const { podpisSvg, klientPritomen, poznamka } = body

  if (klientPritomen && !podpisSvg) {
    return NextResponse.json({ error: 'Chybí podpis klienta' }, { status: 422 })
  }

  await db.$transaction(async tx => {
    await tx.predavak.update({
      where: { id: params.predavakId },
      data: {
        stav: 'PODPISAN',
        podpisano: new Date(),
        podpisSvg: podpisSvg ?? null,
        klientPritomen: klientPritomen ?? true,
        poznamka: poznamka ?? predavak.poznamka,
      },
    })

    const stavOrder = ['NOVA', 'PRIRAZENA', 'V_REALIZACI', 'PREDANA', 'VYUCTOVANA', 'HOTOVO']
    const currentIdx = stavOrder.indexOf(predavak.zakazka.stav)
    const predanaIdx = stavOrder.indexOf('PREDANA')
    if (currentIdx < predanaIdx) {
      await tx.zakazka.update({
        where: { id: predavak.zakazkaId },
        data: { stav: 'PREDANA' },
      })
    }

    const vedouciId = predavak.zakazka.vedouciId
    if (vedouciId) {
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

    await tx.auditLog.create({
      data: {
        orgId,
        userId: session!.user.id,
        typAkce: 'UPDATE',
        typZaznamu: 'Predavak',
        zaznamId: params.predavakId,
        zaznamNazev: predavak.cislo,
        zmeny: { stavPred: predavak.stav, stavPo: 'PODPISAN' },
      },
    })
  })

  return NextResponse.json({ ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
