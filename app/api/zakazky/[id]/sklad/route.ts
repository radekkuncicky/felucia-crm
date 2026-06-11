import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const { polozkaId, mnozstvi, nakupniCena, poznamka } = await req.json()

  if (!polozkaId || !mnozstvi || nakupniCena === undefined) {
    return NextResponse.json({ error: 'Chybí povinná pole' }, { status: 400 })
  }

  // Verify polozka belongs to this zakazka & org
  const polozka = await prisma.zakazkaPolozka.findFirst({
    where: { id: polozkaId, zakazkaId: params.id, zakazka: { orgId } },
  })
  if (!polozka) return NextResponse.json({ error: 'Položka nenalezena' }, { status: 404 })

  const zakazka = await prisma.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Zakázka nenalezena' }, { status: 404 })

  const shouldAdvanceStav = zakazka.stav === 'PRIRAZENA' || zakazka.stav === 'NOVA'

  await prisma.$transaction([
    prisma.skladPohyb.create({
      data: {
        orgId,
        zakazkaId: params.id,
        polozkaId,
        typ: 'REZERVACE',
        nazev: polozka.nazev,
        mnozstvi,
        nakupniCena,
        duvod: poznamka ?? null,
        vytvorilId: session.user.id,
      },
    }),
    prisma.zakazkaPolozka.update({
      where: { id: polozkaId },
      data: { stav: 'NASKLADNENO', nakupniCena },
    }),
    prisma.auditLog.create({
      data: {
        orgId,
        userId: session.user.id,
        typAkce: 'UPDATE',
        typZaznamu: 'ZakazkaPolozka',
        zaznamId: polozkaId,
        zaznamNazev: polozka.nazev,
        zmeny: { stav: 'NASKLADNENO', nakupniCena },
      },
    }),
    ...(shouldAdvanceStav ? [
      prisma.zakazka.update({
        where: { id: params.id },
        data: { stav: 'V_REALIZACI' },
      }),
      prisma.auditLog.create({
        data: {
          orgId,
          userId: session.user.id,
          typAkce: 'UPDATE',
          typZaznamu: 'Zakazka',
          zaznamId: params.id,
          zaznamNazev: zakazka.nazev,
          zmeny: { from: zakazka.stav, to: 'V_REALIZACI', duvod: 'První naskladnění' },
        },
      }),
    ] : []),
  ])

  return NextResponse.json({ ok: true, zakazkaNovyStav: shouldAdvanceStav ? 'V_REALIZACI' : null })
}
