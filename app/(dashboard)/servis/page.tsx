import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import PlatinumGuard from '@/components/PlatinumGuard'
import { getPlanLimits } from '@/lib/planLimits'
import { getPerms } from '@/lib/permissions'
import Link from 'next/link'
import ServisOverviewClient from './ServisOverviewClient'
import type { Prisma } from '@prisma/client'

const LIST_INCLUDE = {
  kontrakt: { select: { nazev: true, klient: { select: { jmeno: true, prijmeni: true } } } },
  zarizeni: { select: { nazev: true } },
  klient: { select: { jmeno: true, prijmeni: true } },
  technik: { select: { id: true, jmeno: true } },
} as const

type Row = {
  id: string
  cislo: string | null
  typ: string
  stav: string
  popis: string | null
  priorita: string
  planovanyTermin: Date | null
  kontrakt: { nazev: string; klient: { jmeno: string; prijmeni: string } } | null
  zarizeni: { nazev: string } | null
  klient: { jmeno: string; prijmeni: string } | null
  technik: { id: string; jmeno: string } | null
}

function serialize(r: Row) {
  return {
    id: r.id,
    cislo: r.cislo,
    typ: r.typ,
    stav: r.stav,
    popis: r.popis,
    priorita: r.priorita,
    planovanyTermin: r.planovanyTermin ? r.planovanyTermin.toISOString() : null,
    klientNazev:
      r.kontrakt?.klient
        ? `${r.kontrakt.klient.jmeno} ${r.kontrakt.klient.prijmeni}`
        : r.klient
        ? `${r.klient.jmeno} ${r.klient.prijmeni}`
        : null,
    predmet: r.zarizeni?.nazev ?? r.kontrakt?.nazev ?? null,
    technikJmeno: r.technik?.jmeno ?? null,
    technikId: r.technik?.id ?? null,
  }
}

export default async function ServisPage() {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const plan = session!.user.plan

  if (!getPlanLimits(plan).hasServiceModule) return <PlatinumGuard />
  const canCreate = getPerms(session!.user).servisDispecink

  const now = new Date()
  const dnesOd = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dnesDo = new Date(dnesOd.getTime() + 86_400_000)
  const horizont30 = new Date(now.getTime() + 30 * 86_400_000)

  // Reaktivní práce = vše mimo rutinní návštěvy ze smluv (typ ≠ PLANOVANY_SERVIS nebo bez kontraktu).
  const pozornostWhere: Prisma.ServisniZakazkaWhereInput = {
    orgId,
    stav: { in: ['NOVA', 'REKLAMACE'] },
    OR: [{ typ: { not: 'PLANOVANY_SERVIS' } }, { kontraktId: null }],
  }
  const urgentniWhere: Prisma.ServisniZakazkaWhereInput = {
    orgId,
    priorita: 'URGENTNI',
    stav: { in: ['NOVA', 'NAPLANOVANA', 'PROBIHA', 'CEKA', 'REKLAMACE'] },
  }
  const prosleWhere: Prisma.ServisniZakazkaWhereInput = { orgId, stav: 'NAPLANOVANA', planovanyTermin: { lt: now } }
  const cekaWhere: Prisma.ServisniZakazkaWhereInput = { orgId, stav: 'CEKA' }
  const nevyfakturovaneWhere: Prisma.ServisniZakazkaWhereInput = { orgId, stav: 'DOKONCENA', vyfakturovano: false }

  const [
    zarizeniCount,
    aktivniKontrakty,
    dnes,
    pozornost,
    urgentni,
    pozornostCount,
    prosle,
    prosleCount,
    cekajici,
    cekaCount,
    nevyfakturovane,
    nevyfakturovaneCount,
    smlouvy30,
    smlouvyZaHorizontem,
    urgentniSTerminemCount,
  ] = await Promise.all([
    prisma.zarizeni.count({ where: { orgId, aktivni: true } }),
    prisma.servisniKontrakt.count({ where: { orgId, aktivni: true } }),
    // Dnes v terénu: termín dnes, nebo právě probíhá
    prisma.servisniZakazka.findMany({
      where: {
        orgId,
        OR: [
          { stav: { in: ['NAPLANOVANA', 'PROBIHA'] }, planovanyTermin: { gte: dnesOd, lt: dnesDo } },
          { stav: 'PROBIHA' },
        ],
      },
      include: LIST_INCLUDE,
      orderBy: { planovanyTermin: 'asc' },
    }),
    prisma.servisniZakazka.findMany({ where: pozornostWhere, include: LIST_INCLUDE, orderBy: [{ priorita: 'desc' }, { vytvoreno: 'desc' }], take: 8 }),
    prisma.servisniZakazka.findMany({ where: urgentniWhere, include: LIST_INCLUDE, orderBy: { vytvoreno: 'desc' }, take: 8 }),
    prisma.servisniZakazka.count({ where: pozornostWhere }),
    prisma.servisniZakazka.findMany({ where: prosleWhere, include: LIST_INCLUDE, orderBy: { planovanyTermin: 'asc' }, take: 8 }),
    prisma.servisniZakazka.count({ where: prosleWhere }),
    prisma.servisniZakazka.findMany({ where: cekaWhere, include: LIST_INCLUDE, orderBy: { vytvoreno: 'desc' }, take: 8 }),
    prisma.servisniZakazka.count({ where: cekaWhere }),
    prisma.servisniZakazka.findMany({ where: nevyfakturovaneWhere, include: LIST_INCLUDE, orderBy: { vytvoreno: 'desc' }, take: 8 }),
    prisma.servisniZakazka.count({ where: nevyfakturovaneWhere }),
    // Blížící se návštěvy ze smluv (30 dní) — informativně, odděleně od reaktivní práce
    prisma.servisniZakazka.findMany({
      where: { orgId, stav: 'NAPLANOVANA', typ: 'PLANOVANY_SERVIS', kontraktId: { not: null }, planovanyTermin: { gte: now, lte: horizont30 } },
      include: LIST_INCLUDE,
      orderBy: { planovanyTermin: 'asc' },
      take: 10,
    }),
    prisma.servisniZakazka.count({
      where: { orgId, stav: 'NAPLANOVANA', typ: 'PLANOVANY_SERVIS', kontraktId: { not: null }, planovanyTermin: { gt: horizont30 } },
    }),
    // urgentní, které už termín mají (nejsou v pozornostWhere, ale hoří dál)
    prisma.servisniZakazka.count({ where: { ...urgentniWhere, stav: { in: ['NAPLANOVANA', 'PROBIHA', 'CEKA'] } } }),
  ])

  // „Urgentní & nezaplánované": urgentní nahoře (i když už mají termín), pak nezaplánovaná reaktivní práce.
  const pozornostIds = new Set<string>()
  const pozornostRows = [...urgentni, ...pozornost].filter(r => {
    if (pozornostIds.has(r.id)) return false
    pozornostIds.add(r.id)
    return true
  }).slice(0, 8)
  const pozornostTotal = pozornostCount + urgentniSTerminemCount

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-6 py-5 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Servisní nástěnka</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Dnes v terénu, co hoří, a co se blíží ze smluv</p>
        </div>
        {canCreate && (
          <Link
            href="/servis/nova"
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors"
          >
            + Nová servisní akce
          </Link>
        )}
      </div>
      <ServisOverviewClient
        stats={{ zarizeniCount, aktivniKontrakty, smlouvyZaHorizontem }}
        dnes={dnes.map(serialize)}
        pozornost={{ items: pozornostRows.map(serialize), total: pozornostTotal }}
        prosle={{ items: prosle.map(serialize), total: prosleCount }}
        cekajici={{ items: cekajici.map(serialize), total: cekaCount }}
        nevyfakturovane={{ items: nevyfakturovane.map(serialize), total: nevyfakturovaneCount }}
        smlouvy30={smlouvy30.map(serialize)}
      />
    </div>
  )
}
