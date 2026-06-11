import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, klientAdresa } from '@/lib/mobile-helpers'

export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  const { id: userId, orgId, role } = session!.user

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  const zakazky = await prisma.zakazka.findMany({
    where: {
      orgId,
      montazOd: { gte: todayStart, lte: todayEnd },
      ...(role === 'TECHNIK'
        ? { techniciRel: { some: { technikId: userId } } }
        : {}),
    },
    include: {
      klient: { select: { jmeno: true, prijmeni: true, telefon: true, ulice: true, mesto: true, psc: true } },
      polozky: { select: { id: true, hotovo: true } },
      techniciRel: { include: { technik: { select: { id: true, jmeno: true } } } },
    },
    orderBy: { montazOd: 'asc' },
  })

  const data = zakazky.map(z => ({
    id: z.id,
    cislo: z.cislo,
    nazev: z.nazev,
    stav: z.stav,
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
  }))

  return NextResponse.json({ date: todayStart.toISOString().split('T')[0], zakazky: data })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
