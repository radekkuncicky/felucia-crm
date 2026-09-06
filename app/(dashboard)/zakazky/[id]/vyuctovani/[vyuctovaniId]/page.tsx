import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import VyuctovaniDetailClient from './VyuctovaniDetailClient'
import { getPerms } from '@/lib/permissions'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'
import { etapaProgressFromRaw } from '@/lib/zakazkaEtapy'

export default async function VyuctovaniDetailPage({
  params,
}: {
  params: { id: string; vyuctovaniId: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) notFound()
  const perms = getPerms(session.user)
  if (!perms.financeProdejni) notFound()
  if (!(await canAccessZakazka(session.user, perms, params.id))) notFound()

  const orgId = session.user.orgId

  const v = await prisma.vyuctovani.findFirst({
    where: { id: params.vyuctovaniId, orgId, zakazkaId: params.id },
    include: {
      polozky: { orderBy: { poradi: 'asc' } },
      zakazka: {
        select: {
          id: true, cislo: true, nazev: true,
          klient: { select: { jmeno: true, prijmeni: true } },
          vedouci: { select: { id: true, jmeno: true } },
          op: { select: { quotes: { where: { aktivni: true }, select: { dphSazba: true }, take: 1 } } },
        },
      },
      schvalil: { select: { jmeno: true } },
      predavak: {
        select: {
          id: true, cislo: true, podpisano: true, klientPritomen: true,
          technik: { select: { jmeno: true } },
          _count: { select: { fotky: true } },
        },
      },
    },
  })
  if (!v) notFound()

  // Nabídka „Schválit a zahájit další etapu" — jen když vyúčtování patří k poslední
  // etapě zakázky a jeho schválením se etapa uzavře (montáž i předávka už hotové)
  let dalsiEtapaCislo: number | null = null
  if (perms.zakazkySchvalovani && perms.zakazkyEdit && v.etapaId) {
    const posledniEtapa = await prisma.zakazkaEtapa.findFirst({
      where: { zakazkaId: params.id, orgId },
      orderBy: { cislo: 'desc' },
      include: { predavaky: { select: { stav: true } }, vyuctovani: { select: { stav: true } } },
    })
    if (posledniEtapa && posledniEtapa.id === v.etapaId) {
      const progress = etapaProgressFromRaw(posledniEtapa)
      if (progress.montazDone && progress.predavkaDone) dalsiEtapaCislo = posledniEtapa.cislo + 1
    }
  }

  const orgSettings = await prisma.orgSettings.findUnique({ where: { orgId }, select: { zakazkyDefaultDph: true } })
  const defaultDph = v.zakazka.op?.quotes?.[0]?.dphSazba != null
    ? Number(v.zakazka.op.quotes[0].dphSazba)
    : (orgSettings?.zakazkyDefaultDph ?? 12)

  return (
    <VyuctovaniDetailClient
      vyuctovani={{
        id: v.id,
        cislo: v.cislo,
        stav: v.stav,
        poznamka: v.poznamka ?? '',
        vytvoreno: v.vytvoreno.toISOString(),
        schvaleno: v.schvaleno?.toISOString() ?? null,
        schvalil: v.schvalil,
        predavak: v.predavak ? {
          id: v.predavak.id,
          cislo: v.predavak.cislo,
          technikJmeno: v.predavak.technik.jmeno,
          podpisano: v.predavak.podpisano?.toISOString() ?? null,
          klientPritomen: v.predavak.klientPritomen,
          fotekCount: v.predavak._count.fotky,
        } : null,
        zakazka: {
          id: v.zakazka.id,
          cislo: v.zakazka.cislo,
          nazev: v.zakazka.nazev,
          klient: v.zakazka.klient,
          vedouci: v.zakazka.vedouci,
        },
        polozky: v.polozky.map(p => ({
          id: p.id,
          nazev: p.nazev,
          mnozstvi: Number(p.mnozstvi),
          jednotka: p.jednotka,
          nakupniCena: perms.financeNakupky && p.nakupniCena !== null ? Number(p.nakupniCena) : null,
          prodejniCena: Number(p.prodejniCena),
          dphSazba: Number(p.dphSazba),
          poradi: p.poradi,
        })),
      }}
      canApprove={perms.zakazkySchvalovani}
      canDelete={perms.zakazkyMazani}
      showNakupky={perms.financeNakupky}
      defaultDph={defaultDph}
      dalsiEtapaCislo={dalsiEtapaCislo}
    />
  )
}
