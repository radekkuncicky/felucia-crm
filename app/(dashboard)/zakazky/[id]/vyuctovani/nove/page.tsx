import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import GenerujVyuctovaniClient from './GenerujVyuctovaniClient'
import { getPerms } from '@/lib/permissions'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'

export default async function GenerujVyuctovaniPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { etapaId?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) notFound()
  const perms = getPerms(session.user)
  if (!perms.zakazkyEdit || !perms.financeProdejni) notFound()
  if (!(await canAccessZakazka(session.user, perms, params.id))) notFound()

  const orgId = session.user.orgId

  const zakazka = await prisma.zakazka.findFirst({
    where: { id: params.id, orgId },
    include: {
      klient: { select: { jmeno: true, prijmeni: true } },
      predavaky: {
        where: { stav: 'SCHVALEN' },
        include: {
          technik: { select: { jmeno: true } },
          polozky: { where: { zahrnuto: true } },
          vyuctovani: { select: { id: true, cislo: true } },
        },
        orderBy: { schvaleno: 'desc' },
      },
    },
  })

  if (!zakazka) notFound()

  return (
    <GenerujVyuctovaniClient
      etapaId={searchParams.etapaId}
      zakazka={{
        id: zakazka.id,
        cislo: zakazka.cislo,
        nazev: zakazka.nazev,
        klient: zakazka.klient,
        predavaky: zakazka.predavaky.map(pp => ({
          id: pp.id,
          cislo: pp.cislo,
          technikJmeno: pp.technik.jmeno,
          schvaleno: pp.schvaleno?.toISOString() ?? null,
          polozkyCount: pp.polozky.length,
          vyuctovani: pp.vyuctovani,
        })),
      }}
    />
  )
}
