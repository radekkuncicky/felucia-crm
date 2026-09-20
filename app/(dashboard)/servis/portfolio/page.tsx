import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import PlatinumGuard from '@/components/PlatinumGuard'
import { getPlanLimits } from '@/lib/planLimits'
import { getPerms } from '@/lib/permissions'
import PortfolioClient from './PortfolioClient'
import type { Kontrakt, NavstevaRef, Zarizeni } from '@/components/servis/types'

// Servisní portfolio: klient → zařízení → kontrakt → historie zakázek na jedné
// stránce. Nahrazuje samostatné seznamy /servis/zarizeni a /servis/kontrakty
// (ty redirectují sem). ?klient=<id> (nebo ?zarizeni=<id>) rozbalí a odscrolluje klienta.

const NAVSTEVA_SELECT = {
  id: true,
  cislo: true,
  typ: true,
  stav: true,
  popis: true,
  priorita: true,
  planovanyTermin: true,
  skutecnyTermin: true,
  technik: { select: { id: true, jmeno: true } },
  zprava: true,
  nalezeneZavady: true,
  doporuceni: true,
  trvaniMinut: true,
  nakladyCas: true,
  nakladyMaterial: true,
  podpisKlienta: true,
} as const

type NavstevaRow = {
  id: string
  cislo: string | null
  typ: string
  stav: string
  popis: string | null
  priorita: string
  planovanyTermin: Date | null
  skutecnyTermin: Date | null
  technik: { id: string; jmeno: string } | null
  zprava: string | null
  nalezeneZavady: string | null
  doporuceni: string | null
  trvaniMinut: number | null
  nakladyCas: unknown
  nakladyMaterial: unknown
  podpisKlienta: string | null
}

function serializeNavsteva(n: NavstevaRow): NavstevaRef {
  return {
    id: n.id,
    cislo: n.cislo,
    typ: n.typ,
    stav: n.stav,
    popis: n.popis,
    priorita: n.priorita,
    planovanyTermin: n.planovanyTermin ? n.planovanyTermin.toISOString() : null,
    skutecnyTermin: n.skutecnyTermin ? n.skutecnyTermin.toISOString() : null,
    technik: n.technik,
    zprava: n.zprava,
    nalezeneZavady: n.nalezeneZavady,
    doporuceni: n.doporuceni,
    trvaniMinut: n.trvaniMinut,
    nakladyCas: n.nakladyCas != null ? Number(n.nakladyCas) : null,
    nakladyMaterial: n.nakladyMaterial != null ? Number(n.nakladyMaterial) : null,
    podpisKlienta: n.podpisKlienta,
  }
}

export default async function PortfolioPage({ searchParams }: { searchParams: { klient?: string; zarizeni?: string } }) {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const plan = session!.user.plan

  if (!getPlanLimits(plan).hasServiceModule) return <PlatinumGuard />
  const perms = getPerms(session!.user)
  if (perms.servis === 'ZADNY') redirect('/')

  const [zarizeniRows, kontraktyRows, zakazkyBezZarizeni, clients, orgUsers] = await Promise.all([
    prisma.zarizeni.findMany({
      where: { orgId },
      include: {
        klient: { select: { id: true, jmeno: true, prijmeni: true, telefon: true, ulice: true, mesto: true, psc: true } },
        deal: { select: { id: true, kod: true, predmet: true } },
        servisniZakazky: { select: NAVSTEVA_SELECT, orderBy: { planovanyTermin: 'asc' } },
      },
      orderBy: { vytvoreno: 'desc' },
    }),
    prisma.servisniKontrakt.findMany({
      where: { orgId },
      include: {
        klient: { select: { id: true, jmeno: true, prijmeni: true, telefon: true, ulice: true, mesto: true, psc: true } },
        deal: { select: { id: true, kod: true, predmet: true } },
        zarizeni: { select: { id: true, nazev: true, typ: true, vyrobniCislo: true } },
        servisniZakazky: { select: NAVSTEVA_SELECT, orderBy: { planovanyTermin: 'asc' } },
      },
      orderBy: { vytvoreno: 'desc' },
    }),
    // Reaktivní akce bez zařízení (klient z ulice) — patří pod klienta jako „bez zařízení"
    prisma.servisniZakazka.findMany({
      where: { orgId, zarizeniId: null, klientId: { not: null } },
      select: { ...NAVSTEVA_SELECT, klientId: true, klient: { select: { id: true, jmeno: true, prijmeni: true, telefon: true, ulice: true, mesto: true, psc: true } } },
      orderBy: { vytvoreno: 'desc' },
    }),
    prisma.client.findMany({
      where: { orgId },
      select: { id: true, jmeno: true, prijmeni: true, telefon: true, ulice: true, mesto: true, psc: true },
      orderBy: { prijmeni: 'asc' },
    }),
    prisma.user.findMany({ where: { orgId, aktivni: true }, select: { id: true, jmeno: true }, orderBy: { jmeno: 'asc' } }),
  ])

  const kontrakty: Kontrakt[] = kontraktyRows.map(k => ({
    id: k.id,
    cisloKontraktu: k.cisloKontraktu,
    nazev: k.nazev,
    typ: k.typ,
    intervalMesicu: k.intervalMesicu,
    cena: k.cena ? String(k.cena) : null,
    zacatek: k.zacatek.toISOString(),
    konec: k.konec ? k.konec.toISOString() : null,
    aktivni: k.aktivni,
    autoRenewal: k.autoRenewal,
    klient: { id: k.klient.id, jmeno: k.klient.jmeno, prijmeni: k.klient.prijmeni },
    zarizeni: k.zarizeni,
    deal: k.deal,
    servisniZakazky: k.servisniZakazky.map(serializeNavsteva),
  }))
  const kontraktyByZarizeni = new Map<string, Kontrakt[]>()
  for (const k of kontrakty) {
    if (!k.zarizeni) continue
    if (!kontraktyByZarizeni.has(k.zarizeni.id)) kontraktyByZarizeni.set(k.zarizeni.id, [])
    kontraktyByZarizeni.get(k.zarizeni.id)!.push(k)
  }

  type KlientInfo = { id: string; jmeno: string; prijmeni: string; telefon: string | null; ulice: string | null; mesto: string | null; psc: string | null }
  type Skupina = { klient: KlientInfo; zarizeni: Zarizeni[]; kontraktyBezZarizeni: Kontrakt[]; zakazkyBezZarizeni: NavstevaRef[] }
  const skupiny = new Map<string, Skupina>()
  const skupina = (klient: KlientInfo): Skupina => {
    if (!skupiny.has(klient.id)) skupiny.set(klient.id, { klient, zarizeni: [], kontraktyBezZarizeni: [], zakazkyBezZarizeni: [] })
    return skupiny.get(klient.id)!
  }

  for (const z of zarizeniRows) {
    skupina(z.klient).zarizeni.push({
      id: z.id,
      nazev: z.nazev,
      typ: z.typ,
      vyrobniCislo: z.vyrobniCislo,
      datumInstalace: z.datumInstalace ? z.datumInstalace.toISOString() : null,
      zarukaDo: z.zarukaDo ? z.zarukaDo.toISOString() : null,
      aktivni: z.aktivni,
      qrToken: z.qrToken,
      klientId: z.klientId,
      deal: z.deal,
      kontrakty: kontraktyByZarizeni.get(z.id) ?? [],
      zakazky: z.servisniZakazky.map(serializeNavsteva),
    })
  }
  for (const k of kontraktyRows) {
    if (k.zarizeni) continue
    skupina(k.klient).kontraktyBezZarizeni.push(kontrakty.find(x => x.id === k.id)!)
  }
  for (const z of zakazkyBezZarizeni) {
    if (!z.klient) continue
    skupina(z.klient).zakazkyBezZarizeni.push(serializeNavsteva(z))
  }

  const klienti = Array.from(skupiny.values())
    .map(s => ({
      ...s,
      klient: {
        ...s.klient,
        adresa: [s.klient.ulice, [s.klient.psc, s.klient.mesto].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null,
      },
    }))
    .sort((a, b) => `${a.klient.prijmeni} ${a.klient.jmeno}`.localeCompare(`${b.klient.prijmeni} ${b.klient.jmeno}`, 'cs'))

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Servisní portfolio</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Klient → zařízení → smlouva → historie. {klienti.length} klientů · {zarizeniRows.filter(z => z.aktivni).length} zařízení · {kontrakty.filter(k => k.aktivni).length} aktivních kontraktů
        </p>
      </div>
      <PortfolioClient
        klienti={klienti}
        clients={clients}
        orgUsers={orgUsers}
        canManage={perms.servisDispecink}
        focusKlientId={searchParams.klient ?? (searchParams.zarizeni ? zarizeniRows.find(z => z.id === searchParams.zarizeni)?.klientId ?? null : null)}
      />
    </div>
  )
}
