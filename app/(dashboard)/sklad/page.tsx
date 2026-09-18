import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPerms } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { klientJmeno } from '@/lib/calendarEvents'
import { orgPrisma } from '@/lib/orgPrisma'
import { stavSkladu } from '@/lib/sklad'
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

  const db = orgPrisma(orgId)

  const [pohyby, zakazky, kpi, stav] = await Promise.all([
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
      // Vydáno tento měsíc = množství × nákupní cena za pohyb
      prisma.skladPohyb.findMany({
        where: { orgId, typ: 'VYDEJ', vytvoreno: { gte: mesicZacatek } },
        select: { mnozstvi: true, nakupniCena: true },
      }),
      prisma.skladPohyb.count({ where: { orgId } }),
    ]),
    stavSkladu(db, orgId),
  ])

  // Zásoby: produkty s alespoň jedním pohybem (sklad v2 — zůstatek se dopočítává z deníku)
  const stavIds = Array.from(stav.keys())
  const produkty = stavIds.length
    ? await prisma.product.findMany({
        where: { orgId, id: { in: stavIds } },
        select: { id: true, kod: true, nazev: true, jednotka: true, minMnozstvi: true, nakladovaCena: true },
        orderBy: [{ kod: 'asc' }, { nazev: 'asc' }],
      })
    : []
  const zasoby = produkty.map(p => {
    const s = stav.get(p.id) ?? { naSklade: 0, rezervovano: 0, dostupne: 0 }
    const cena = p.nakladovaCena !== null ? Number(p.nakladovaCena) : null
    return {
      id: p.id,
      kod: p.kod,
      nazev: p.nazev,
      jednotka: p.jednotka,
      minMnozstvi: p.minMnozstvi !== null ? Number(p.minMnozstvi) : null,
      nakladovaCena: perms.financeNakupky ? cena : null,
      ...s,
      hodnota: perms.financeNakupky && cena !== null ? Math.max(s.naSklade, 0) * cena : null,
    }
  })
  const hodnotaZasoby = zasoby.reduce((sum, z) => sum + (z.hodnota ?? 0), 0)
  const hodnotaRezervaci = zasoby.reduce((sum, z) => sum + (z.nakladovaCena !== null ? Math.max(z.rezervovano, 0) * z.nakladovaCena : 0), 0)
  const vydejMesicHodnota = kpi[0].reduce((sum, p) => sum + Number(p.mnozstvi) * Number(p.nakupniCena ?? 0), 0)

  return (
    <SkladPageClient
      pohyby={pohyby.map(p => ({
        id: p.id,
        typ: p.typ,
        productId: p.productId,
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
      zasoby={zasoby}
      zakazky={zakazky}
      kpi={{
        zasobaHodnota: perms.financeNakupky ? hodnotaZasoby : 0,
        rezervaceHodnota: perms.financeNakupky ? hodnotaRezervaci : 0,
        vydejMesicHodnota: perms.financeNakupky ? vydejMesicHodnota : 0,
        pocetPohybu: kpi[1],
        podMinimem: zasoby.filter(z => z.minMnozstvi !== null && z.dostupne <= z.minMnozstvi).length,
      }}
      canPrijem={perms.sklad === 'PLNY'}
      showNakupky={perms.financeNakupky}
    />
  )
}
