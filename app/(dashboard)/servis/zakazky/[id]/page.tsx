import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import PlatinumGuard from '@/components/PlatinumGuard'
import { getPlanLimits } from '@/lib/planLimits'
import ZakazkaDetailClient from './ZakazkaDetailClient'

const KLIENT_SELECT = {
  id: true,
  jmeno: true,
  prijmeni: true,
  ulice: true,
  mesto: true,
  psc: true,
  telefon: true,
} as const

export default async function ServisZakazkaDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const plan = session!.user.plan
  const role = session!.user.role

  if (!getPlanLimits(plan).hasServiceModule) return <PlatinumGuard />

  const z = await prisma.servisniZakazka.findFirst({
    where: { id: params.id, orgId },
    include: {
      kontrakt: {
        select: {
          id: true,
          nazev: true,
          cisloKontraktu: true,
          klient: { select: KLIENT_SELECT },
        },
      },
      zarizeni: { select: { id: true, nazev: true, typ: true, vyrobniCislo: true } },
      klient: { select: KLIENT_SELECT },
      technik: { select: { id: true, jmeno: true } },
    },
  })

  if (!z) notFound()

  // Technik vidí jen své zakázky
  if (role === 'TECHNIK' && z.technikId !== session!.user.id) notFound()

  const orgUsers = await prisma.user.findMany({
    where: { orgId, aktivni: true },
    select: { id: true, jmeno: true },
    orderBy: { jmeno: 'asc' },
  })

  const klient = z.kontrakt?.klient ?? z.klient ?? null

  const data = {
    id: z.id,
    cislo: z.cislo,
    typ: z.typ,
    stav: z.stav,
    planovanyTermin: z.planovanyTermin ? z.planovanyTermin.toISOString() : null,
    skutecnyTermin: z.skutecnyTermin ? z.skutecnyTermin.toISOString() : null,
    trvaniMinut: z.trvaniMinut,
    technikId: z.technikId,
    technik: z.technik,
    cekaDuvod: z.cekaDuvod,
    poznamka: z.poznamka,
    zprava: z.zprava,
    nalezeneZavady: z.nalezeneZavady,
    doporuceni: z.doporuceni,
    nakladyCas: z.nakladyCas ? String(z.nakladyCas) : null,
    nakladyMaterial: z.nakladyMaterial ? String(z.nakladyMaterial) : null,
    fotky: (z.fotky as string[]) ?? [],
    protokolDokoncen: z.protokolDokoncen ? z.protokolDokoncen.toISOString() : null,
    vyfakturovano: z.vyfakturovano,
    zaplaceno: z.zaplaceno,
    klient: klient
      ? {
          id: klient.id,
          jmeno: `${klient.jmeno} ${klient.prijmeni}`,
          adresa: [klient.ulice, [klient.mesto, klient.psc].filter(Boolean).join(' ')].filter(Boolean).join(', '),
          telefon: klient.telefon,
        }
      : null,
    kontrakt: z.kontrakt ? { id: z.kontrakt.id, nazev: z.kontrakt.nazev, cisloKontraktu: z.kontrakt.cisloKontraktu } : null,
    zarizeni: z.zarizeni,
  }

  return <ZakazkaDetailClient zakazka={data} orgUsers={orgUsers} canEdit={true} />
}
