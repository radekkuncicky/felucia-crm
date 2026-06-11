import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import VyuctovaniDetailClient from './VyuctovaniDetailClient'

export default async function VyuctovaniDetailPage({
  params,
}: {
  params: { id: string; vyuctovaniId: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) notFound()
  if (session.user.role === 'TECHNIK') notFound()

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
    },
  })
  if (!v) notFound()

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
          nakupniCena: p.nakupniCena !== null ? Number(p.nakupniCena) : null,
          prodejniCena: Number(p.prodejniCena),
          dphSazba: Number(p.dphSazba),
          poradi: p.poradi,
        })),
      }}
      role={session.user.role}
      defaultDph={defaultDph}
    />
  )
}
