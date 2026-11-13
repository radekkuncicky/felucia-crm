import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin } from '@/lib/mobile-helpers'
import { VYKAZ_INCLUDE, serializeZaznam, souctyVykazu } from '@/lib/vykazPrace'
import { nezapsaneDnes } from '@/lib/vykazPripominka'
import { dnesPraha } from '@/lib/dnesniVyjezdy'
import { getOrgSettings } from '@/lib/orgSettings'

// GET /api/mobile/vykaz/souhrn — nevyfakturované záznamy technika + součty + historie fakturací
// + dnešní výjezdy bez zápisu, součty za tento měsíc a stav večerní připomínky
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId, id: userId, perms, plan } = session!.user
  const db = orgPrisma(orgId)
  const dnes = dnesPraha()
  const mesicOd = new Date(`${dnes.slice(0, 7)}-01T00:00:00.000Z`)
  const [zaznamy, fakturace, user, mesicZaznamy, settings] = await Promise.all([
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
    db.user.findFirst({ where: { id: userId, orgId }, select: { sazbaHodina: true, sazbaKm: true, vykazPripominka: true } }),
    db.vykazPrace.findMany({
      where: { orgId, userId, datum: { gte: mesicOd } },
      select: { typ: true, hodiny: true, km: true, sazbaHodina: true, sazbaKm: true, castka: true },
    }),
    getOrgSettings(orgId),
  ])
  const dnesNezapsano = await nezapsaneDnes(db, { orgId, userId, perms, plan, modulServis: settings.modulServis })

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
    dnesNezapsano,
    mesic: { mesic: dnes.slice(0, 7), ...souctyVykazu(mesicZaznamy) },
    pripominka: user?.vykazPripominka ?? true,
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
