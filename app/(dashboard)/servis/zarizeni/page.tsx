import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import PlatinumGuard from '@/components/PlatinumGuard'
import { getPlanLimits } from '@/lib/planLimits'
import ZarizeniClient from './ZarizeniClient'

export default async function ZarizeniPage() {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const plan = session!.user.plan

  if (!getPlanLimits(plan).hasServiceModule) return <PlatinumGuard />

  const [zarizeni, clients] = await Promise.all([
    prisma.zarizeni.findMany({
      where: { orgId },
      include: {
        klient: { select: { id: true, jmeno: true, prijmeni: true } },
        deal: { select: { id: true, kod: true, predmet: true } },
        servisniKontrakty: {
          where: { aktivni: true },
          select: { id: true, nazev: true, typ: true, konec: true, cisloKontraktu: true },
        },
        servisniZakazky: {
          where: { stav: { in: ['NAPLANOVANA'] } },
          orderBy: { planovanyTermin: 'asc' },
          take: 1,
          select: { planovanyTermin: true },
        },
      },
      orderBy: { vytvoreno: 'desc' },
    }),
    prisma.client.findMany({
      where: { orgId },
      select: { id: true, jmeno: true, prijmeni: true },
      orderBy: { jmeno: 'asc' },
    }),
  ])

  const serialized = zarizeni.map(z => ({
    ...z,
    vytvoreno: z.vytvoreno.toISOString(),
    datumInstalace: z.datumInstalace ? z.datumInstalace.toISOString() : null,
    zarukaDo: z.zarukaDo ? z.zarukaDo.toISOString() : null,
    servisniKontrakty: z.servisniKontrakty.map(k => ({
      ...k,
      konec: k.konec ? k.konec.toISOString() : null,
    })),
    servisniZakazky: z.servisniZakazky.map(n => ({
      planovanyTermin: n.planovanyTermin!.toISOString(),
    })),
  }))

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Zařízení</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Přehled nainstalovaných zařízení u klientů</p>
      </div>
      <ZarizeniClient zarizeni={serialized} clients={clients} />
    </div>
  )
}
