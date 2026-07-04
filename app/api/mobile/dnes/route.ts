import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, klientAdresa, toAbsoluteUrl } from '@/lib/mobile-helpers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapZakazka(z: any, origin: string) {
  const titulniFotoUrl = toAbsoluteUrl(z.titulniFotoUrl, origin)
  return {
    id: z.id,
    cislo: z.cislo,
    nazev: z.nazev,
    stav: z.stav,
    montazOd: z.montazOd,
    montazDo: z.montazDo,
    adresa: klientAdresa(z.klient),
    mistoStavby: z.mistoStavby ?? null,
    titulniFotoUrl,
    klient: {
      jmeno: z.klient.jmeno,
      prijmeni: z.klient.prijmeni,
      telefon: z.klient.telefon ?? null,
    },
    polozky: {
      celkem: z.polozky.length,
      hotovo: z.polozky.filter((p: { hotovo: boolean }) => p.hotovo).length,
    },
    technici: z.techniciRel.map((t: { technik: { id: string; jmeno: string } }) => ({ id: t.technik.id, jmeno: t.technik.jmeno })),
  }
}

export async function GET(req: Request) {
  const host = req.headers.get('host') ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const origin = host ? `${proto}://${host}` : new URL(req.url).origin

  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  const { id: userId, orgId, role } = session!.user
  const db = orgPrisma(orgId)

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  const in60Days = new Date(todayStart.getTime() + 60 * 24 * 60 * 60 * 1000)

  const technikFilter = role === 'TECHNIK' ? { techniciRel: { some: { technikId: userId } } } : {}
  const include = {
    klient: { select: { jmeno: true, prijmeni: true, telefon: true, ulice: true, mesto: true, psc: true } },
    polozky: { select: { id: true, hotovo: true } },
    techniciRel: { include: { technik: { select: { id: true, jmeno: true } } } },
  }

  const [dnesZakazky, upcomingZakazky, bezTerminuZakazky] = await Promise.all([
    db.zakazka.findMany({
      where: { orgId, montazOd: { gte: todayStart, lte: todayEnd }, ...technikFilter },
      include,
      orderBy: { montazOd: 'asc' },
    }),
    db.zakazka.findMany({
      where: {
        orgId,
        montazOd: { gt: todayEnd, lte: in60Days },
        stav: { notIn: ['HOTOVO', 'VYUCTOVANA'] },
        ...technikFilter,
      },
      include,
      orderBy: { montazOd: 'asc' },
    }),
    db.zakazka.findMany({
      where: {
        orgId,
        montazOd: null,
        stav: { notIn: ['HOTOVO', 'VYUCTOVANA'] },
        ...technikFilter,
      },
      include,
      orderBy: { cislo: 'asc' },
    }),
  ])

  return NextResponse.json({
    date: todayStart.toISOString().split('T')[0],
    zakazky: dnesZakazky.map(z => mapZakazka(z, origin)),
    upcoming: upcomingZakazky.map(z => mapZakazka(z, origin)),
    bezTerminu: bezTerminuZakazky.map(z => mapZakazka(z, origin)),
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
