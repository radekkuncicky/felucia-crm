import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin } from '@/lib/mobile-helpers'
import { VYKAZ_INCLUDE, serializeZaznam, souctyVykazu } from '@/lib/vykazPrace'

// GET /api/mobile/vykaz/souhrn — nevyfakturované záznamy technika + součty + historie fakturací
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)
  const [zaznamy, fakturace, user] = await Promise.all([
    db.vykazPrace.findMany({
      where: { orgId, userId, fakturaceId: null },
      include: VYKAZ_INCLUDE,
      orderBy: [{ datum: 'asc' }, { vytvoreno: 'asc' }],
    }),
    db.vykazFakturace.findMany({
      where: { orgId, userId },
      orderBy: { cislo: 'desc' },
      take: 50,
    }),
    db.user.findFirst({ where: { id: userId, orgId }, select: { sazbaHodina: true, sazbaKm: true } }),
  ])

  return NextResponse.json({
    zaznamy: zaznamy.map(serializeZaznam),
    soucty: souctyVykazu(zaznamy),
    obdobi: zaznamy.length
      ? { od: zaznamy[0].datum.toISOString().slice(0, 10), do: zaznamy[zaznamy.length - 1].datum.toISOString().slice(0, 10) }
      : null,
    sazby: {
      sazbaHodina: user?.sazbaHodina == null ? null : Number(user.sazbaHodina),
      sazbaKm: user?.sazbaKm == null ? null : Number(user.sazbaKm),
    },
    fakturace: fakturace.map(f => ({
      id: f.id,
      cislo: f.cislo,
      obdobiOd: f.obdobiOd.toISOString().slice(0, 10),
      obdobiDo: f.obdobiDo.toISOString().slice(0, 10),
      hodiny: Number(f.hodinyCelkem),
      km: f.kmCelkem,
      castka: Number(f.castkaCelkem),
      vytvoreno: f.vytvoreno,
    })),
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
