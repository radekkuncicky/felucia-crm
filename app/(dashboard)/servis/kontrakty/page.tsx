import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import PlatinumGuard from '@/components/PlatinumGuard'
import { getPlanLimits } from '@/lib/planLimits'
import KontraktyClient from './KontraktyClient'

export default async function KontraktyPage() {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const plan = session!.user.plan

  if (!getPlanLimits(plan).hasServiceModule) return <PlatinumGuard />

  const [kontrakty, orgUsers, zarizeniList] = await Promise.all([
    prisma.servisniKontrakt.findMany({
      where: { orgId },
      include: {
        klient: { select: { id: true, jmeno: true, prijmeni: true } },
        deal: { select: { id: true, kod: true, predmet: true } },
        zarizeni: {
          select: { id: true, nazev: true, typ: true, vyrobniCislo: true },
        },
        servisniZakazky: {
          include: { technik: { select: { id: true, jmeno: true } } },
          orderBy: { planovanyTermin: 'asc' },
        },
      },
      orderBy: { vytvoreno: 'desc' },
    }),
    prisma.user.findMany({
      where: { orgId, aktivni: true },
      select: { id: true, jmeno: true },
      orderBy: { jmeno: 'asc' },
    }),
    prisma.zarizeni.findMany({
      where: { orgId, aktivni: true },
      include: { klient: { select: { id: true, jmeno: true, prijmeni: true } } },
      orderBy: { vytvoreno: 'desc' },
    }),
  ])

  const serialized = kontrakty.map(k => ({
    ...k,
    cena: k.cena ? String(k.cena) : null,
    zacatek: k.zacatek.toISOString(),
    konec: k.konec ? k.konec.toISOString() : null,
    vytvoreno: k.vytvoreno.toISOString(),
    servisniZakazky: k.servisniZakazky.map(n => ({
      ...n,
      planovanyTermin: n.planovanyTermin!.toISOString(),
      skutecnyTermin: n.skutecnyTermin ? n.skutecnyTermin.toISOString() : null,
      vytvoreno: n.vytvoreno.toISOString(),
      nakladyCas: n.nakladyCas ? Number(n.nakladyCas) : null,
      nakladyMaterial: n.nakladyMaterial ? Number(n.nakladyMaterial) : null,
      fotky: (n.fotky as string[]) ?? [],
      podpisKlienta: n.podpisKlienta ?? null,
    })),
  }))

  const zarizeniSerialized = zarizeniList.map(z => ({
    ...z,
    datumInstalace: z.datumInstalace ? z.datumInstalace.toISOString() : null,
    zarukaDo: z.zarukaDo ? z.zarukaDo.toISOString() : null,
    vytvoreno: z.vytvoreno.toISOString(),
  }))

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Servisní kontrakty</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Přehled servisních smluv a plánovaných návštěv</p>
        </div>
      </div>
      <KontraktyClient kontrakty={serialized} orgUsers={orgUsers} zarizeniList={zarizeniSerialized} />
    </div>
  )
}
