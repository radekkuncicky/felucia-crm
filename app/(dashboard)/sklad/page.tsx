import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPerms } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { klientJmeno } from '@/lib/calendarEvents'
import { notFound } from 'next/navigation'
import SkladPageClient from './SkladPageClient'

export default async function SkladPage() {
  const session = await getServerSession(authOptions)
  if (!session) notFound()
  const perms = getPerms(session.user)
  if (perms.sklad === 'ZADNY') notFound()

  const orgId = session.user.orgId
  const now = new Date()
  const mesicZacatek = new Date(now.getFullYear(), now.getMonth(), 1)

  const [pohyby, zakazky, kpi] = await Promise.all([
    prisma.skladPohyb.findMany({
      where: { orgId },
      include: {
        zakazka: {
          select: {
            id: true,
            cislo: true,
            nazev: true,
            technologie: true,
            klient: { select: { jmeno: true, prijmeni: true } },
          },
        },
        vytvoril: { select: { id: true, jmeno: true } },
      },
      orderBy: { vytvoreno: 'desc' },
      take: 300,
    }),
    prisma.zakazka.findMany({
      where: { orgId },
      select: { id: true, cislo: true, nazev: true },
      orderBy: { vytvoreno: 'desc' },
    }),
    Promise.all([
      prisma.skladPohyb.aggregate({ where: { orgId, typ: 'REZERVACE' }, _sum: { nakupniCena: true } }),
      prisma.skladPohyb.aggregate({ where: { orgId, typ: 'VYDEJ', vytvoreno: { gte: mesicZacatek } }, _sum: { nakupniCena: true } }),
      prisma.skladPohyb.count({ where: { orgId } }),
    ]),
  ])

  return (
    <SkladPageClient
      pohyby={pohyby.map(p => ({
        id: p.id,
        typ: p.typ,
        nazev: p.nazev,
        mnozstvi: Number(p.mnozstvi),
        nakupniCena: perms.financeNakupky && p.nakupniCena !== null ? Number(p.nakupniCena) : null,
        duvod: p.duvod,
        vytvoreno: p.vytvoreno.toISOString(),
        zakazka: p.zakazka
          ? {
              id: p.zakazka.id,
              cislo: p.zakazka.cislo,
              nazev: p.zakazka.nazev,
              klient: klientJmeno(p.zakazka.klient),
              technologie: p.zakazka.technologie,
            }
          : null,
        vytvoril: p.vytvoril,
      }))}
      zakazky={zakazky}
      kpi={{
        rezervaceHodnota: perms.financeNakupky ? Number(kpi[0]._sum.nakupniCena ?? 0) : 0,
        vydejMesicHodnota: perms.financeNakupky ? Number(kpi[1]._sum.nakupniCena ?? 0) : 0,
        pocetPohybu: kpi[2],
      }}
      canPrijem={perms.sklad === 'PLNY'}
      showNakupky={perms.financeNakupky}
    />
  )
}
