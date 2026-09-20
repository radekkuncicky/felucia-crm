import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import PlatinumGuard from '@/components/PlatinumGuard'
import { getPlanLimits } from '@/lib/planLimits'
import { getPerms } from '@/lib/permissions'
import NovaServisniAkceForm from './NovaServisniAkceForm'

// Založení servisní akce „z ulice": klient (existující / nový) → zařízení
// (existující / nové / žádné) → co se děje → kdy a kdo. Deep-link
// ?klientId= / ?zarizeniId= z detailu klienta, portfolia a palety.
export default async function NovaServisniAkcePage({
  searchParams,
}: {
  searchParams: { klientId?: string; zarizeniId?: string }
}) {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const plan = session!.user.plan

  if (!getPlanLimits(plan).hasServiceModule) return <PlatinumGuard />
  if (!getPerms(session!.user).servisDispecink) redirect('/servis/zakazky')

  const [clients, zarizeni, orgUsers] = await Promise.all([
    prisma.client.findMany({
      where: { orgId },
      select: { id: true, jmeno: true, prijmeni: true, telefon: true, ulice: true, mesto: true, psc: true },
      orderBy: { prijmeni: 'asc' },
    }),
    prisma.zarizeni.findMany({
      where: { orgId, aktivni: true },
      select: {
        id: true,
        klientId: true,
        nazev: true,
        typ: true,
        vyrobniCislo: true,
        servisniKontrakty: { where: { aktivni: true }, select: { id: true, nazev: true }, take: 1 },
      },
      orderBy: { vytvoreno: 'desc' },
    }),
    prisma.user.findMany({
      where: { orgId, aktivni: true },
      select: { id: true, jmeno: true },
      orderBy: { jmeno: 'asc' },
    }),
  ])

  const zarizeniList = zarizeni.map(z => ({
    id: z.id,
    klientId: z.klientId,
    nazev: z.nazev,
    typ: z.typ,
    vyrobniCislo: z.vyrobniCislo,
    kontrakt: z.servisniKontrakty[0] ?? null,
  }))

  // Deep-link na zařízení určuje i klienta.
  const initialZarizeni = searchParams.zarizeniId
    ? zarizeniList.find(z => z.id === searchParams.zarizeniId) ?? null
    : null
  const initialKlientId = initialZarizeni?.klientId ?? searchParams.klientId ?? ''

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nová servisní akce</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Zavolal klient? Zapiš kdo, co a kde — termín a technika lze doplnit později v plánu.
        </p>
      </div>
      <NovaServisniAkceForm
        clients={clients}
        zarizeniList={zarizeniList}
        orgUsers={orgUsers}
        initialKlientId={initialKlientId}
        initialZarizeniId={initialZarizeni?.id ?? ''}
      />
    </div>
  )
}
