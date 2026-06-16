import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import PlatinumGuard from '@/components/PlatinumGuard'
import { getPlanLimits } from '@/lib/planLimits'
import PlanClient from './PlanClient'

export default async function PlanPage() {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const plan = session!.user.plan

  if (!getPlanLimits(plan).hasServiceModule) return <PlatinumGuard />

  const [navstevy, orgUsers, zarizeniList] = await Promise.all([
    prisma.servisniZakazka.findMany({
      where: {
        orgId,
        stav: { in: ['NAPLANOVANA', 'PROBIHA'] },
      },
      include: {
        kontrakt: {
          include: { klient: { select: { id: true, jmeno: true, prijmeni: true, ulice: true, mesto: true, psc: true } } },
        },
        zarizeni: { select: { id: true, nazev: true, typ: true } },
        technik: { select: { id: true, jmeno: true } },
      },
      orderBy: { planovanyTermin: 'asc' },
    }),
    prisma.user.findMany({
      where: { orgId, aktivni: true },
      select: { id: true, jmeno: true },
      orderBy: { jmeno: 'asc' },
    }),
    prisma.zarizeni.findMany({
      where: { orgId, aktivni: true },
      include: {
        klient: { select: { id: true, jmeno: true, prijmeni: true } },
        servisniKontrakty: { where: { aktivni: true }, select: { id: true }, take: 1 },
      },
      orderBy: { vytvoreno: 'desc' },
    }),
  ])

  const serialized = navstevy.map(n => ({
    ...n,
    planovanyTermin: n.planovanyTermin!.toISOString(),
    skutecnyTermin: n.skutecnyTermin ? n.skutecnyTermin.toISOString() : null,
    vytvoreno: n.vytvoreno.toISOString(),
    kontrakt: n.kontrakt ? {
      ...n.kontrakt,
      cena: n.kontrakt.cena ? String(n.kontrakt.cena) : null,
      zacatek: n.kontrakt.zacatek.toISOString(),
      konec: n.kontrakt.konec ? n.kontrakt.konec.toISOString() : null,
      vytvoreno: n.kontrakt.vytvoreno.toISOString(),
    } : null,
  }))

  const zarizeniSerialized = zarizeniList.map(z => ({
    id: z.id,
    nazev: z.nazev,
    typ: z.typ,
    klient: z.klient,
    kontraktyId: z.servisniKontrakty[0]?.id ?? null,
  }))

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Plán servisů</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Všechny naplánované servisní návštěvy chronologicky podle data</p>
      </div>
      <PlanClient navstevy={serialized} orgUsers={orgUsers} zarizeniList={zarizeniSerialized} />
    </div>
  )
}
