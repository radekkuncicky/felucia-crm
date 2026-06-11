import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, klientAdresa } from '@/lib/mobile-helpers'
import type { ZakazkaStav } from '@prisma/client'

export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  const { id: userId, orgId, role } = session!.user
  const db = orgPrisma(orgId)
  const url = new URL(req.url)

  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20')))
  const stavParam = url.searchParams.get('stav') as ZakazkaStav | null
  const skip = (page - 1) * limit

  const where = {
    orgId,
    ...(stavParam ? { stav: stavParam } : {}),
    ...(role === 'TECHNIK'
      ? { techniciRel: { some: { technikId: userId } } }
      : {}),
  }

  const [zakazky, total] = await Promise.all([
    db.zakazka.findMany({
      where,
      include: {
        klient: { select: { jmeno: true, prijmeni: true, telefon: true, ulice: true, mesto: true, psc: true } },
        polozky: { select: { id: true, hotovo: true } },
        techniciRel: { include: { technik: { select: { id: true, jmeno: true } } } },
      },
      orderBy: [{ montazOd: 'desc' }, { vytvoreno: 'desc' }],
      skip,
      take: limit,
    }),
    db.zakazka.count({ where }),
  ])

  const data = zakazky.map(z => ({
    id: z.id,
    cislo: z.cislo,
    nazev: z.nazev,
    stav: z.stav,
    typ: z.typ,
    montazOd: z.montazOd,
    montazDo: z.montazDo,
    adresa: klientAdresa(z.klient),
    klient: {
      jmeno: z.klient.jmeno,
      prijmeni: z.klient.prijmeni,
      telefon: z.klient.telefon ?? null,
    },
    polozky: {
      celkem: z.polozky.length,
      hotovo: z.polozky.filter(p => p.hotovo).length,
    },
    technici: z.techniciRel.map(t => ({ id: t.technik.id, jmeno: t.technik.jmeno })),
    vytvoreno: z.vytvoreno,
  }))

  return NextResponse.json({
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
