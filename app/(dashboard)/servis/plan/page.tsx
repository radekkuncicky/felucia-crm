import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import PlatinumGuard from '@/components/PlatinumGuard'
import { getPlanLimits } from '@/lib/planLimits'
import DispecinkClient from './PlanClient'

const ROW_INCLUDE = {
  kontrakt: {
    select: { nazev: true, klient: { select: { jmeno: true, prijmeni: true, ulice: true, mesto: true, psc: true } } },
  },
  zarizeni: { select: { nazev: true } },
  klient: { select: { jmeno: true, prijmeni: true, ulice: true, mesto: true, psc: true } },
} as const

function adresa(k: { ulice: string | null; mesto: string | null; psc: string | null } | null | undefined): string | null {
  if (!k) return null
  const radek = [k.mesto, k.psc].filter(Boolean).join(' ')
  const out = [k.ulice, radek].filter(Boolean).join(', ')
  return out || null
}

export default async function PlanPage() {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const plan = session!.user.plan

  if (!getPlanLimits(plan).hasServiceModule) return <PlatinumGuard />

  const [zakazky, orgUsers] = await Promise.all([
    // Vše, co se dá plánovat: bez termínu (pool) i s termínem (rozmístí se do týdnů).
    prisma.servisniZakazka.findMany({
      where: { orgId, stav: { in: ['NOVA', 'NAPLANOVANA', 'PROBIHA', 'CEKA'] } },
      include: ROW_INCLUDE,
      orderBy: [{ planovanyTermin: 'asc' }, { vytvoreno: 'desc' }],
    }),
    prisma.user.findMany({
      where: { orgId, aktivni: true },
      select: { id: true, jmeno: true },
      orderBy: { jmeno: 'asc' },
    }),
  ])

  const rows = zakazky.map(z => {
    const klientObj = z.kontrakt?.klient ?? z.klient
    return {
      id: z.id,
      cislo: z.cislo,
      typ: z.typ,
      stav: z.stav,
      planovanyTermin: z.planovanyTermin ? z.planovanyTermin.toISOString() : null,
      technikId: z.technikId,
      klientNazev: klientObj ? `${klientObj.jmeno} ${klientObj.prijmeni}` : null,
      predmet: z.zarizeni?.nazev ?? z.kontrakt?.nazev ?? null,
      adresa: adresa(klientObj),
    }
  })

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dispečink servisů</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Přetáhni zakázku na den a přiřaď technika</p>
      </div>
      <DispecinkClient rows={rows} orgUsers={orgUsers} />
    </div>
  )
}
