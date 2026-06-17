import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import PlatinumGuard from '@/components/PlatinumGuard'
import { getPlanLimits } from '@/lib/planLimits'
import ServisOverviewClient from './ServisOverviewClient'

const LIST_INCLUDE = {
  kontrakt: { select: { nazev: true, klient: { select: { jmeno: true, prijmeni: true } } } },
  zarizeni: { select: { nazev: true } },
  klient: { select: { jmeno: true, prijmeni: true } },
  technik: { select: { jmeno: true } },
} as const

type Row = {
  id: string
  cislo: string | null
  typ: string
  stav: string
  planovanyTermin: Date | null
  kontrakt: { nazev: string; klient: { jmeno: string; prijmeni: string } } | null
  zarizeni: { nazev: string } | null
  klient: { jmeno: string; prijmeni: string } | null
  technik: { jmeno: string } | null
}

function serialize(r: Row) {
  return {
    id: r.id,
    cislo: r.cislo,
    typ: r.typ,
    stav: r.stav,
    planovanyTermin: r.planovanyTermin ? r.planovanyTermin.toISOString() : null,
    klientNazev:
      r.kontrakt?.klient
        ? `${r.kontrakt.klient.jmeno} ${r.kontrakt.klient.prijmeni}`
        : r.klient
        ? `${r.klient.jmeno} ${r.klient.prijmeni}`
        : null,
    predmet: r.zarizeni?.nazev ?? r.kontrakt?.nazev ?? null,
    technikJmeno: r.technik?.jmeno ?? null,
  }
}

export default async function ServisPage() {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const plan = session!.user.plan

  if (!getPlanLimits(plan).hasServiceModule) return <PlatinumGuard />

  const now = new Date()

  const [
    zarizeniCount,
    aktivniKontrakty,
    nezaplanovane,
    prosle,
    cekajici,
    nevyfakturovane,
  ] = await Promise.all([
    prisma.zarizeni.count({ where: { orgId, aktivni: true } }),
    prisma.servisniKontrakt.count({ where: { orgId, aktivni: true } }),
    prisma.servisniZakazka.findMany({
      where: { orgId, stav: 'NOVA' },
      include: LIST_INCLUDE,
      orderBy: { vytvoreno: 'desc' },
      take: 8,
    }),
    prisma.servisniZakazka.findMany({
      where: { orgId, stav: 'NAPLANOVANA', planovanyTermin: { lt: now } },
      include: LIST_INCLUDE,
      orderBy: { planovanyTermin: 'asc' },
      take: 8,
    }),
    prisma.servisniZakazka.findMany({
      where: { orgId, stav: 'CEKA' },
      include: LIST_INCLUDE,
      orderBy: { vytvoreno: 'desc' },
      take: 8,
    }),
    prisma.servisniZakazka.findMany({
      where: { orgId, stav: 'DOKONCENA', vyfakturovano: false },
      include: LIST_INCLUDE,
      orderBy: { vytvoreno: 'desc' },
      take: 8,
    }),
  ])

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Servisní nástěnka</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Co vyžaduje pozornost — zakázky podle stavu</p>
      </div>
      <ServisOverviewClient
        stats={{ zarizeniCount, aktivniKontrakty }}
        nezaplanovane={nezaplanovane.map(serialize)}
        prosle={prosle.map(serialize)}
        cekajici={cekajici.map(serialize)}
        nevyfakturovane={nevyfakturovane.map(serialize)}
      />
    </div>
  )
}
