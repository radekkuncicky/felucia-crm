import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import PlatinumGuard from '@/components/PlatinumGuard'
import { getPlanLimits } from '@/lib/planLimits'
import ZakazkySeznamClient from './ZakazkySeznamClient'
import { getPerms, servisScopeWhere } from '@/lib/permissions'
import { redirect } from 'next/navigation'

export default async function ServisZakazkyPage() {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const plan = session!.user.plan

  if (!getPlanLimits(plan).hasServiceModule) return <PlatinumGuard />

  const perms = getPerms(session!.user)
  const scope = servisScopeWhere(perms, session!.user.id)
  if (!scope) redirect('/')

  const [zakazky, orgUsers] = await Promise.all([
    prisma.servisniZakazka.findMany({
      where: { orgId, ...scope },
      include: {
        kontrakt: {
          select: {
            id: true,
            nazev: true,
            klient: { select: { id: true, jmeno: true, prijmeni: true } },
          },
        },
        zarizeni: { select: { id: true, nazev: true, typ: true } },
        klient: { select: { id: true, jmeno: true, prijmeni: true } },
        technik: { select: { id: true, jmeno: true } },
      },
      orderBy: [{ planovanyTermin: 'asc' }, { vytvoreno: 'desc' }],
    }),
    prisma.user.findMany({
      where: { orgId, aktivni: true },
      select: { id: true, jmeno: true },
      orderBy: { jmeno: 'asc' },
    }),
  ])

  const rows = zakazky.map(z => ({
    id: z.id,
    cislo: z.cislo,
    typ: z.typ,
    stav: z.stav,
    planovanyTermin: z.planovanyTermin ? z.planovanyTermin.toISOString() : null,
    skutecnyTermin: z.skutecnyTermin ? z.skutecnyTermin.toISOString() : null,
    vyfakturovano: z.vyfakturovano,
    popis: z.popis,
    priorita: z.priorita,
    kontraktId: z.kontraktId,
    technik: z.technik,
    klientNazev:
      z.kontrakt?.klient
        ? `${z.kontrakt.klient.jmeno} ${z.kontrakt.klient.prijmeni}`
        : z.klient
        ? `${z.klient.jmeno} ${z.klient.prijmeni}`
        : null,
    predmet: z.zarizeni?.nazev ?? z.kontrakt?.nazev ?? null,
  }))

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Servisní zakázky</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Všechny servisní zásahy — plánované i reaktivní</p>
      </div>
      <ZakazkySeznamClient
        zakazky={rows}
        orgUsers={orgUsers}
       
        canCreate={perms.servisDispecink}
      />
    </div>
  )
}
