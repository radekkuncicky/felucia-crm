import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import ZakazkyPageClient from './ZakazkyPageClient'
import type { KeSchvaleniPolozka } from './KeSchvaleniBar'
import { aktualniFazeLabel, etapaProgressFromRaw } from '@/lib/zakazkaEtapy'
import { getPerms, zakazkyScopeWhere, isTechnikView } from '@/lib/permissions'
import { listVedouciKandidati } from '@/lib/zakazkyHelpers'

export default async function ZakazkyPage() {
  const session = await getServerSession(authOptions)
  if (!session) notFound()

  const orgId = session.user.orgId
  const perms = getPerms(session.user)
  const scope = zakazkyScopeWhere(perms, session.user.id)
  if (!scope) notFound()
  const isTechnik = isTechnikView(perms)
  const canApprove = perms.zakazkySchvalovani

  const where = { orgId, typ: 'OBCHODNI' as const, AND: [scope] }

  const [zakazky, vedouci, cekaPredavaky, cekaVyuctovani] = await Promise.all([
    prisma.zakazka.findMany({
      where,
      include: {
        klient: { select: { id: true, jmeno: true, prijmeni: true } },
        vedouci: { select: { id: true, jmeno: true } },
        techniciRel: { include: { technik: { select: { id: true, jmeno: true } } } },
        _count: { select: { polozky: true, predavaky: true } },
        op: {
          select: {
            quotes: {
              where: { aktivni: true },
              take: 1,
              select: {
                items: { select: { mnozstvi: true, cenaZaKus: true, sleva: true } },
              },
            },
          },
        },
        vyuctovani: {
          select: {
            polozky: { select: { mnozstvi: true, prodejniCena: true } },
          },
        },
        etapy: {
          orderBy: { cislo: 'asc' },
          select: {
            cislo: true,
            nazev: true,
            stav: true,
            predavaky: { select: { stav: true } },
            vyuctovani: { select: { stav: true } },
          },
        },
      },
      orderBy: { vytvoreno: 'desc' },
    }),
    isTechnik ? Promise.resolve([]) : listVedouciKandidati(orgId),
    !canApprove
      ? Promise.resolve([])
      : prisma.predavak.findMany({
          where: { orgId, stav: 'PODPISAN' },
          select: {
            id: true, cislo: true, podpisano: true, zakazkaId: true,
            zakazka: { select: { cislo: true } },
            technik: { select: { jmeno: true } },
          },
          orderBy: { podpisano: 'asc' },
        }),
    !canApprove
      ? Promise.resolve([])
      : prisma.vyuctovani.findMany({
          where: { orgId, stav: 'KE_SCHVALENI' },
          select: {
            id: true, cislo: true, vytvoreno: true, zakazkaId: true,
            zakazka: { select: { cislo: true, nazev: true } },
          },
          orderBy: { vytvoreno: 'asc' },
        }),
  ])

  const keSchvaleni: KeSchvaleniPolozka[] = [
    ...cekaPredavaky.map(p => ({
      id: p.id,
      cislo: p.cislo,
      zakazkaId: p.zakazkaId,
      zakazkaCislo: p.zakazka.cislo,
      popis: p.technik.jmeno,
      datum: p.podpisano?.toISOString() ?? null,
      href: `/zakazky/${p.zakazkaId}/predavaky/${p.id}`,
      typ: 'PREDAVAK' as const,
    })),
    ...cekaVyuctovani.map(v => ({
      id: v.id,
      cislo: v.cislo,
      zakazkaId: v.zakazkaId,
      zakazkaCislo: v.zakazka.cislo,
      popis: v.zakazka.nazev,
      datum: v.vytvoreno.toISOString(),
      href: `/zakazky/${v.zakazkaId}/vyuctovani/${v.id}`,
      typ: 'VYUCTOVANI' as const,
    })),
  ]

  const rows = zakazky.map(z => {
    const activeQuote = z.op?.quotes[0] ?? null
    const cenaOP = activeQuote
      ? activeQuote.items.reduce(
          (s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus) * (1 - Number(i.sleva) / 100),
          0
        )
      : null

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
      montazOd: z.montazOd?.toISOString() ?? null,
      montazDo: z.montazDo?.toISOString() ?? null,
      updatedAt: z.updatedAt.toISOString(),
      cenaOP,
      cenaVyuctovani,
      aktualniFaze: aktualniFazeLabel(z.etapy.map(etapaProgressFromRaw)),
    }
  })

  return (
    <ZakazkyPageClient
      zakazky={rows}
      vedouci={vedouci}
      isTechnik={isTechnik}
      canCreate={perms.zakazkyEdit}
      canApprove={canApprove}
      showCeny={perms.financeProdejni}
      keSchvaleni={keSchvaleni}
    />
  )
}
