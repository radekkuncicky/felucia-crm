import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { leadProAppku } from '@/lib/leadMobile'

// GET /api/mobile/obchod/leady — leady pro Felucia Sales.
// ?uzavrene=1 → převedené/zamítnuté za 60 dní; jinak otevřené (NOVY/KONTAKTOVAN/KVALIFIKOVAN).
// Vidí je každý s oprávněním obchod (jako web). Řazení: nové nahoře, pak podle data.
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr
  if (session!.user.plan === 'STARTER') return NextResponse.json({ error: 'Leady nejsou v tomto plánu.' }, { status: 403 })

  const { orgId } = session!.user
  const db = orgPrisma(orgId)
  const uzavrene = new URL(req.url).searchParams.get('uzavrene') === '1'

  const leady = await db.lead.findMany({
    where: uzavrene
      ? { orgId, status: { in: ['PREVEDEN', 'ZRUSEN'] }, updatedAt: { gte: new Date(Date.now() - 60 * 86400_000) } }
      : { orgId, status: { in: ['NOVY', 'KONTAKTOVAN', 'KVALIFIKOVAN'] } },
    include: {
      assignedTo: { select: { id: true, jmeno: true } },
      zdrojPoptavky: { select: { nazev: true } },
      // nejbližší naplánovaný krok (hovor / e-mail)
      activities: {
        where: { stav: 'PLANOVANA' },
        select: { id: true, typ: true, datum: true, cas: true },
        orderBy: [{ datum: 'asc' }, { cas: 'asc' }],
        take: 1,
      },
    },
    orderBy: { vytvoreno: 'desc' },
    take: 200,
  })

  const poradi = { NOVY: 0, KONTAKTOVAN: 1, KVALIFIKOVAN: 1, PREVEDEN: 2, ZRUSEN: 2 } as const
  return NextResponse.json(
    leady
      .sort((a, b) => poradi[a.status] - poradi[b.status])
      .map(l => ({ ...leadProAppku(l), dalsiKrok: l.activities[0] ?? null })),
  )
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
