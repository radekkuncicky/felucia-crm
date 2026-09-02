import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import PredavakClient from './PredavakClient'
import { getPerms } from '@/lib/permissions'
import { canAccessPredavak } from '@/lib/zakazkyHelpers'

export default async function PredavakPage({
  params,
}: {
  params: { id: string; predavakId: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) notFound()

  const orgId = session.user.orgId
  const perms = getPerms(session.user)

  const predavak = await prisma.predavak.findFirst({
    where: { id: params.predavakId, orgId },
    include: {
      technik: { select: { id: true, jmeno: true, email: true } },
      schvalil: { select: { id: true, jmeno: true } },
      zakazka: {
        include: {
          klient: { select: { id: true, jmeno: true, prijmeni: true, telefon: true, email: true } },
          vedouci: { select: { id: true, jmeno: true } },
        },
      },
      polozky: { orderBy: { id: 'asc' } },
      fotky: { orderBy: { vytvoreno: 'asc' } },
      vyuctovani: { select: { id: true, cislo: true } },
    },
  })

  if (!predavak) notFound()

  // Vlastní protokol, nebo zakázka v rozsahu uživatele
  if (!(await canAccessPredavak(session.user, perms, predavak))) notFound()

  // Verify zakazkaId matches
  if (predavak.zakazkaId !== params.id) notFound()

  return (
    <PredavakClient
      predavak={{
        id: predavak.id,
        cislo: predavak.cislo,
        stav: predavak.stav,
        poznamka: predavak.poznamka ?? '',
        klientPritomen: predavak.klientPritomen,
        podpisSvg: predavak.podpisSvg ?? null,
        odmitnutoDuvod: predavak.odmitnutoDuvod ?? null,
        upravenoPodpisano: predavak.upravenoPodpisano,
        vytvoreno: predavak.vytvoreno.toISOString(),
        podpisano: predavak.podpisano?.toISOString() ?? null,
        schvaleno: predavak.schvaleno?.toISOString() ?? null,
        technik: predavak.technik,
        schvalil: predavak.schvalil,
        zakazka: {
          id: predavak.zakazka.id,
          cislo: predavak.zakazka.cislo,
          nazev: predavak.zakazka.nazev,
          klient: predavak.zakazka.klient,
          vedouci: predavak.zakazka.vedouci,
        },
        polozky: predavak.polozky.map(p => ({
          id: p.id,
          nazev: p.nazev,
          planovanoMnozstvi: Number(p.planovanoMnozstvi),
          mnozstviPouzito: Number(p.mnozstviPouzito),
          jednotka: p.jednotka,
          zahrnuto: p.zahrnuto,
          poznamka: p.poznamka ?? '',
        })),
        fotky: predavak.fotky.map(f => ({
          id: f.id,
          url: f.url,
          popis: f.popis ?? '',
          vytvoreno: f.vytvoreno.toISOString(),
        })),
        vyuctovani: predavak.vyuctovani,
      }}
      currentUserId={session.user.id}
      canApprove={perms.zakazkySchvalovani}
      showVyuctovani={perms.financeProdejni}
    />
  )
}
