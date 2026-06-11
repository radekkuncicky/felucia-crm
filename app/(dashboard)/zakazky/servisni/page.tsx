import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import ServisniZakazkyClient from './ServisniZakazkyClient'

export default async function ServisniZakazkyPage() {
  const session = await getServerSession(authOptions)
  if (!session) notFound()

  // Access check
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { serviceAccess: true, role: true },
  })
  if (user?.role !== 'ADMIN' && !user?.serviceAccess) redirect('/zakazky')

  const orgId = session.user.orgId
  const role = session.user.role
  const isTechnik = role === 'TECHNIK'

  const where: Record<string, unknown> = { orgId, typ: 'SERVISNI' }
  if (isTechnik) {
    where.techniciRel = { some: { technikId: session.user.id } }
  }

  const [zakazky, vedouci] = await Promise.all([
    prisma.zakazka.findMany({
      where,
      include: {
        klient: { select: { id: true, jmeno: true, prijmeni: true } },
        vedouci: { select: { id: true, jmeno: true } },
        techniciRel: { include: { technik: { select: { id: true, jmeno: true } } } },
        _count: { select: { polozky: true, predavaky: true } },
        vyuctovani: {
          select: {
            polozky: { select: { mnozstvi: true, prodejniCena: true } },
          },
        },
      },
      orderBy: { vytvoreno: 'desc' },
    }),
    isTechnik
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: { orgId, aktivni: true, role: { in: ['ADMIN'] } },
          select: { id: true, jmeno: true },
          orderBy: { jmeno: 'asc' },
        }),
  ])

  const rows = zakazky.map(z => {
    const cenaVyuctovani = z.vyuctovani.reduce(
      (sum, v) => sum + v.polozky.reduce((s, p) => s + Number(p.mnozstvi) * Number(p.prodejniCena), 0),
      0
    )
    return {
      id: z.id,
      cislo: z.cislo,
      nazev: z.nazev,
      stav: z.stav,
      technologie: z.technologie ?? null,
      klientId: z.klient.id,
      klientJmeno: `${z.klient.jmeno} ${z.klient.prijmeni}`,
      vedouciId: z.vedouci?.id ?? null,
      vedouciJmeno: z.vedouci?.jmeno ?? null,
      technici: z.techniciRel.map(t => ({ id: t.technik.id, jmeno: t.technik.jmeno })),
      pocetPolozek: z._count.polozky,
      pocetPredavaku: z._count.predavaky,
      vytvoreno: z.vytvoreno.toISOString(),
      cenaVyuctovani,
    }
  })

  return <ServisniZakazkyClient zakazky={rows} vedouci={vedouci} role={role} />
}
