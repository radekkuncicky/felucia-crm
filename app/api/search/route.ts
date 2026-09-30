import { getServerSession } from 'next-auth'
import { dealScopeWhere, clientScopeWhere, servisScopeWhere, zakazkyScopeWhere, getPerms } from '@/lib/permissions'
import { getOrgSettings } from '@/lib/orgSettings'
import { navFlags } from '@/lib/navigation'
import { getPlanLimits } from '@/lib/planLimits'
import { typLabel } from '@/lib/servisStav'
import { authOptions } from '@/lib/auth'
import { getMobileSession } from '@/lib/mobile-auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const webSession = await getServerSession(authOptions)
  const session = webSession ?? await getMobileSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  // Rozsah podle oprávnění — bez obchodu jen vlastní klienti/OP (technik neprohledává celou databázi)
  const perms = getPerms(session.user)
  const clientScope = clientScopeWhere(perms, session.user.id) ?? { id: '__none__' }
  const dealScope = dealScopeWhere(perms, session.user.id) ?? { id: '__none__' }
  // Servis jen s modulem v plánu i zapnutým v nastavení a s přístupem (technik VLASTNI vidí své zakázky)
  const orgSettings = await getOrgSettings(orgId)
  const flags = navFlags({ perms, plan: session.user.plan, orgSettings })
  const servisScope = getPlanLimits(session.user.plan).hasServiceModule && orgSettings.modulServis
    ? servisScopeWhere(perms, session.user.id)
    : null
  // Zakázky, leady a produkty jen pro web — mobilní appky znají jen client/deal/servis
  const zakazkyScope = webSession ? zakazkyScopeWhere(perms, session.user.id) : null
  const hledatLeady = !!webSession && flags.leady
  const hledatProdukty = !!webSession && flags.obchod

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const contains = { contains: q, mode: 'insensitive' as const }
  const [clients, deals, servis, zakazky, leady, produkty] = await Promise.all([
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
    zakazkyScope
      ? db.zakazka.findMany({
          where: {
            orgId,
            AND: [zakazkyScope],
            OR: [
              { cislo: contains },
              { nazev: contains },
              { mistoStavby: contains },
              { klient: { jmeno: contains } },
              { klient: { prijmeni: contains } },
            ],
          },
          take: 5,
          orderBy: { vytvoreno: 'desc' },
          select: { id: true, cislo: true, nazev: true, klient: { select: { jmeno: true, prijmeni: true } } },
        })
      : Promise.resolve([]),
    hledatLeady
      ? db.lead.findMany({
          where: { orgId, OR: [{ jmeno: contains }, { firma: contains }, { email: contains }, { telefon: contains }] },
          take: 5,
          orderBy: { vytvoreno: 'desc' },
          select: { id: true, jmeno: true, firma: true, email: true, telefon: true },
        })
      : Promise.resolve([]),
    hledatProdukty
      ? db.product.findMany({
          where: { orgId, aktivni: true, OR: [{ nazev: contains }, { kod: contains }] },
          take: 5,
          orderBy: { nazev: 'asc' },
          select: { id: true, kod: true, nazev: true, produktovaRada: true },
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
    ...zakazky.map(z => ({
      type: 'zakazka' as const,
      id: z.id,
      label: z.nazev,
      sub: `${z.cislo} · ${z.klient.jmeno} ${z.klient.prijmeni}`,
      href: `/zakazky/${z.id}`,
    })),
    ...leady.map(l => ({
      type: 'lead' as const,
      id: l.id,
      label: l.firma ? `${l.firma} (${l.jmeno})` : l.jmeno,
      sub: l.email ?? l.telefon ?? '',
      href: `/leady/${l.id}`,
    })),
    ...produkty.map(p => ({
      type: 'product' as const,
      id: p.id,
      label: p.nazev,
      sub: [p.kod, p.produktovaRada].filter(Boolean).join(' · '),
      href: `/products/${p.id}`,
    })),
  ]

  return NextResponse.json(results)
}
