import { getServerSession } from 'next-auth'
import { dealScopeWhere, clientScopeWhere, servisScopeWhere, getPerms } from '@/lib/permissions'
import { getPlanLimits } from '@/lib/planLimits'
import { typLabel } from '@/lib/servisStav'
import { authOptions } from '@/lib/auth'
import { getMobileSession } from '@/lib/mobile-auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions) ?? await getMobileSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  // Rozsah podle oprávnění — bez obchodu jen vlastní klienti/OP (technik neprohledává celou databázi)
  const perms = getPerms(session.user)
  const clientScope = clientScopeWhere(perms, session.user.id) ?? { id: '__none__' }
  const dealScope = dealScopeWhere(perms, session.user.id) ?? { id: '__none__' }
  // Servis jen s modulem v plánu a s přístupem (technik VLASTNI vidí své zakázky)
  const servisScope = getPlanLimits(session.user.plan).hasServiceModule
    ? servisScopeWhere(perms, session.user.id)
    : null

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const [clients, deals, servis] = await Promise.all([
    db.client.findMany({
      where: {
        orgId,
        AND: [clientScope],
        OR: [
          { jmeno: { contains: q, mode: 'insensitive' } },
          { prijmeni: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { telefon: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: { id: true, jmeno: true, prijmeni: true, email: true },
    }),
    db.deal.findMany({
      where: {
        orgId,
        AND: [dealScope],
        OR: [
          { kod: { contains: q, mode: 'insensitive' } },
          { predmet: { contains: q, mode: 'insensitive' } },
          { client: { jmeno: { contains: q, mode: 'insensitive' } } },
          { client: { prijmeni: { contains: q, mode: 'insensitive' } } },
        ],
      },
      take: 5,
      include: { client: { select: { jmeno: true, prijmeni: true } } },
    }),
    servisScope
      ? db.servisniZakazka.findMany({
          where: {
            orgId,
            AND: [servisScope],
            OR: [
              { cislo: { contains: q, mode: 'insensitive' } },
              { popis: { contains: q, mode: 'insensitive' } },
              { klient: { jmeno: { contains: q, mode: 'insensitive' } } },
              { klient: { prijmeni: { contains: q, mode: 'insensitive' } } },
              { kontrakt: { klient: { prijmeni: { contains: q, mode: 'insensitive' } } } },
              { zarizeni: { nazev: { contains: q, mode: 'insensitive' } } },
            ],
          },
          take: 5,
          orderBy: { vytvoreno: 'desc' },
          select: {
            id: true,
            cislo: true,
            typ: true,
            popis: true,
            klient: { select: { jmeno: true, prijmeni: true } },
            kontrakt: { select: { klient: { select: { jmeno: true, prijmeni: true } } } },
          },
        })
      : Promise.resolve([]),
  ])

  const results = [
    ...clients.map(c => ({
      type: 'client' as const,
      id: c.id,
      label: `${c.jmeno} ${c.prijmeni}`,
      sub: c.email ?? '',
      href: `/clients/${c.id}`,
    })),
    ...deals.map(d => ({
      type: 'deal' as const,
      id: d.id,
      label: d.predmet ?? d.kod ?? 'Bez názvu',
      sub: `${d.kod ?? ''} · ${d.client.jmeno} ${d.client.prijmeni}`.trim().replace(/^·\s*/, ''),
      href: `/deals/${d.id}`,
    })),
    ...servis.map(z => {
      const k = z.kontrakt?.klient ?? z.klient
      return {
        type: 'servis' as const,
        id: z.id,
        label: z.popis ?? typLabel(z.typ),
        sub: [z.cislo, k ? `${k.jmeno} ${k.prijmeni}` : null].filter(Boolean).join(' · '),
        href: `/servis/zakazky/${z.id}`,
      }
    }),
  ]

  return NextResponse.json(results)
}
