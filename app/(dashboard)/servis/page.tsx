import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import PlatinumGuard from '@/components/PlatinumGuard'
import { getPlanLimits } from '@/lib/planLimits'
import ServisOverviewClient from './ServisOverviewClient'

export default async function ServisPage() {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const plan = session!.user.plan

  if (!getPlanLimits(plan).hasServiceModule) return <PlatinumGuard />

  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const [
    zarizeniCount,
    aktivniKontrakty,
    nadchazejiNavstevy,
    presleNavstevy,
    upcomingNavstevy,
  ] = await Promise.all([
    prisma.zarizeni.count({ where: { orgId, aktivni: true } }),
    prisma.servisniKontrakt.count({ where: { orgId, aktivni: true } }),
    prisma.servisniNavsteva.count({
      where: { orgId, stav: 'PLANOVANA', planovanyTermin: { lte: thirtyDaysFromNow, gte: now } },
    }),
    prisma.servisniNavsteva.count({
      where: { orgId, stav: 'PLANOVANA', planovanyTermin: { lt: now } },
    }),
    prisma.servisniNavsteva.findMany({
      where: {
        orgId,
        stav: { in: ['PLANOVANA', 'POTVRZENA'] },
        planovanyTermin: { lte: thirtyDaysFromNow },
      },
      include: {
        kontrakt: {
          include: { klient: { select: { id: true, jmeno: true, prijmeni: true } } },
        },
        zarizeni: { select: { id: true, nazev: true, typ: true } },
        technik: { select: { id: true, jmeno: true } },
      },
      orderBy: { planovanyTermin: 'asc' },
      take: 20,
    }),
  ])

  const serializedNavstevy = upcomingNavstevy.map(n => ({
    ...n,
    planovanyTermin: n.planovanyTermin.toISOString(),
    skutecnyTermin: n.skutecnyTermin ? n.skutecnyTermin.toISOString() : null,
    vytvoreno: n.vytvoreno.toISOString(),
    nakladyCas: n.nakladyCas ? String(n.nakladyCas) : null,
    nakladyMaterial: n.nakladyMaterial ? String(n.nakladyMaterial) : null,
    kontrakt: n.kontrakt ? {
      ...n.kontrakt,
      cena: n.kontrakt.cena ? String(n.kontrakt.cena) : null,
      zacatek: n.kontrakt.zacatek.toISOString(),
      konec: n.kontrakt.konec ? n.kontrakt.konec.toISOString() : null,
      vytvoreno: n.kontrakt.vytvoreno.toISOString(),
    } : null,
  }))

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Servisní přehled</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Správa zařízení, kontraktů a servisních návštěv</p>
      </div>
      <ServisOverviewClient
        stats={{ zarizeniCount, aktivniKontrakty, nadchazejiNavstevy, presleNavstevy }}
        upcomingNavstevy={serializedNavstevy}
      />
    </div>
  )
}
