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

  const body = await req.json()
  const { podpisSvg, klientPritomen, poznamka } = body

  // Appka posílá aktuální stav položek z obrazovky (zaškrtnutí, množství) — technik nemusí
  // před podpisem zvlášť ukládat. Jen položky tohoto protokolu, ostatní se ignorují.
  type PolozkaVstup = { id: string; zahrnuto?: boolean; mnozstviPouzito?: number; poznamka?: string | null }
  const mojeIds = new Set(predavak.polozky.map(p => p.id))
  const zmeny: PolozkaVstup[] = Array.isArray(body.polozky)
    ? (body.polozky as PolozkaVstup[]).filter(p => p && typeof p.id === 'string' && mojeIds.has(p.id))
    : []
  const zmenyMap = new Map(zmeny.map(p => [p.id, p]))
  const zahrnuto = predavak.polozky.filter(p => {
    const z = zmenyMap.get(p.id)
    return z && typeof z.zahrnuto === 'boolean' ? z.zahrnuto : p.zahrnuto
  })
  if (zahrnuto.length === 0) {
    return NextResponse.json({ error: 'Musí být zaškrtnuta aspoň 1 položka' }, { status: 422 })
  }

  if (klientPritomen && !podpisSvg) {
    return NextResponse.json({ error: 'Chybí podpis klienta' }, { status: 422 })
  }

  await db.$transaction(async tx => {
    for (const p of zmeny) {
      const mnozstvi = Number(p.mnozstviPouzito)
      await tx.predavakPolozka.update({
        where: { id: p.id, predavakId: params.predavakId },
        data: {
          ...(typeof p.zahrnuto === 'boolean' ? { zahrnuto: p.zahrnuto } : {}),
          ...(Number.isFinite(mnozstvi) && mnozstvi >= 0 ? { mnozstviPouzito: mnozstvi } : {}),
          ...(p.poznamka !== undefined ? { poznamka: p.poznamka } : {}),
        },
      })
    }
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
          url: `/zakazky/${predavak.zakazkaId}?tab=protokoly#predavaky`,
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
