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
          id: true, cislo: true, nazev: true, stav: true,
          klient: { select: { jmeno: true, prijmeni: true } },
          vedouci: { select: { id: true, jmeno: true } },
          op: { select: { quotes: { where: { aktivni: true }, select: { dphSazba: true, kod: true, nazev: true, items: { orderBy: { poradi: 'asc' }, select: { productId: true, kod: true, nazev: true, jednotka: true, mnozstvi: true, cenaZaKus: true, sleva: true } } }, take: 1 } } },
        },
      },
      schvalil: { select: { jmeno: true } },
      etapa: { select: { cislo: true } },
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
  } else if (perms.zakazkySchvalovani && perms.zakazkyEdit && !v.etapaId) {
    // Zakázka zatím bez etap: stávající práce se při zahájení stane Etapou 1, nová bude 2
    const [pocetEtap, schvalenyPredavak] = await Promise.all([
      prisma.zakazkaEtapa.count({ where: { zakazkaId: params.id, orgId } }),
      prisma.predavak.count({ where: { zakazkaId: params.id, orgId, etapaId: null, stav: 'SCHVALEN' } }),
    ])
    if (pocetEtap === 0 && schvalenyPredavak > 0) dalsiEtapaCislo = 2
  }

  const orgSettings = await prisma.orgSettings.findUnique({ where: { orgId }, select: { zakazkyDefaultDph: true } })
  const defaultDph = v.zakazka.op?.quotes?.[0]?.dphSazba != null
    ? Number(v.zakazka.op.quotes[0].dphSazba)
    : (orgSettings?.zakazkyDefaultDph ?? 12)

  const aktivniCN = v.zakazka.op?.quotes?.[0] ?? null

  // Ostatní vyúčtování zakázky — porovnání s CN jde přes celou zakázku (všechny etapy)
  const ostatniVyu = aktivniCN ? await prisma.vyuctovani.findMany({
    where: { zakazkaId: params.id, orgId, id: { not: v.id } },
    orderBy: { vytvoreno: 'asc' },
    select: {
      id: true, cislo: true, stav: true, vytvoreno: true, etapa: { select: { cislo: true } },
      polozky: { select: { productId: true, kod: true, nazev: true, jednotka: true, mnozstvi: true, prodejniCena: true, sleva: true } },
    },
  }) : []

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
          productId: p.productId,
          kod: p.kod,
          nazev: p.nazev,
          mnozstvi: Number(p.mnozstvi),
          jednotka: p.jednotka,
          nakupniCena: perms.financeNakupky && p.nakupniCena !== null ? Number(p.nakupniCena) : null,
          prodejniCena: Number(p.prodejniCena),
          sleva: Number(p.sleva),
          dphSazba: Number(p.dphSazba),
          poradi: p.poradi,
        })),
      }}
      canApprove={perms.zakazkySchvalovani}
      canDelete={perms.zakazkyMazani}
      showNakupky={perms.financeNakupky}
      defaultDph={defaultDph}
      dalsiEtapaCislo={dalsiEtapaCislo}
      zakazkaStav={v.zakazka.stav}
      canEditZakazka={perms.zakazkyEdit}
      etapaCislo={v.etapa?.cislo ?? null}
      cnProPorovnani={aktivniCN ? {
        nazev: [aktivniCN.kod, aktivniCN.nazev].filter(Boolean).join(' — ') || 'Aktivní nabídka',
        polozky: aktivniCN.items.map(i => ({
          productId: i.productId, kod: i.kod, nazev: i.nazev ?? '', jednotka: i.jednotka,
          mnozstvi: Number(i.mnozstvi), cenaZaKus: Number(i.cenaZaKus), sleva: Number(i.sleva ?? 0),
        })),
      } : null}
      ostatniVyuctovani={ostatniVyu.map(o => ({
        id: o.id, cislo: o.cislo, stav: o.stav, vytvoreno: o.vytvoreno.toISOString(), etapaCislo: o.etapa?.cislo ?? null,
        polozky: o.polozky.map(p => ({
          productId: p.productId, kod: p.kod, nazev: p.nazev, jednotka: p.jednotka,
          mnozstvi: Number(p.mnozstvi), prodejniCena: Number(p.prodejniCena), sleva: Number(p.sleva),
        })),
      }))}
    />
  )
}
