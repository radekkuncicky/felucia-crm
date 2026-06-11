import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import SkladPageClient from './SkladPageClient'

export default async function SkladPage() {
  const session = await getServerSession(authOptions)
  if (!session) notFound()
  if (session.user.role === 'TECHNIK') notFound()

  const orgId = session.user.orgId
  const now = new Date()
  const mesicZacatek = new Date(now.getFullYear(), now.getMonth(), 1)

  const [pohyby, zakazky, kpi] = await Promise.all([
    prisma.skladPohyb.findMany({
      where: { orgId },
      include: {
        zakazka: { select: { id: true, cislo: true, nazev: true } },
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
        nakupniCena: p.nakupniCena !== null ? Number(p.nakupniCena) : null,
        duvod: p.duvod,
        vytvoreno: p.vytvoreno.toISOString(),
        zakazka: p.zakazka ? { id: p.zakazka.id, cislo: p.zakazka.cislo, nazev: p.zakazka.nazev } : null,
        vytvoril: p.vytvoril,
      }))}
      zakazky={zakazky}
      kpi={{
        rezervaceHodnota: Number(kpi[0]._sum.nakupniCena ?? 0),
        vydejMesicHodnota: Number(kpi[1]._sum.nakupniCena ?? 0),
        pocetPohybu: kpi[2],
      }}
    />
  )
}
