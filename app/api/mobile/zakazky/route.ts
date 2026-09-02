import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { zakazkyScopeWhere } from '@/lib/permissions'
import { getMobileOrWebSession, requireTechnikOrAdmin, klientAdresa, toAbsoluteUrl } from '@/lib/mobile-helpers'
import type { ZakazkaStav } from '@prisma/client'

export async function GET(req: Request) {
  const host = req.headers.get('host') ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const origin = host ? `${proto}://${host}` : new URL(req.url).origin

  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  const { id: userId, orgId } = session!.user
  const scope = zakazkyScopeWhere(session!.user.perms, userId)
  if (scope === null) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = orgPrisma(orgId)
  const url = new URL(req.url)

  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20')))
  const stavParam = url.searchParams.get('stav') as ZakazkaStav | null
  // filtr=aktivni|hotove — technik nepotřebuje 6 interních stavů
  const filtr = url.searchParams.get('filtr')
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100)
  const skip = (page - 1) * limit

  const AKTIVNI: ZakazkaStav[] = ['NOVA', 'PRIRAZENA', 'V_REALIZACI']
  const HOTOVE: ZakazkaStav[] = ['PREDANA', 'VYUCTOVANA', 'HOTOVO']

  const where = {
    orgId,
    ...(stavParam ? { stav: stavParam } : {}),
    ...(filtr === 'aktivni' ? { stav: { in: AKTIVNI } } : {}),
    ...(filtr === 'hotove' ? { stav: { in: HOTOVE } } : {}),
    AND: [scope],
    ...(q
      ? {
          OR: [
            { cislo: { contains: q, mode: 'insensitive' as const } },
            { nazev: { contains: q, mode: 'insensitive' as const } },
            { mistoStavby: { contains: q, mode: 'insensitive' as const } },
            { klient: { jmeno: { contains: q, mode: 'insensitive' as const } } },
            { klient: { prijmeni: { contains: q, mode: 'insensitive' as const } } },
          ],
        }
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
    mistoStavby: z.mistoStavby ?? null,
    titulniFotoUrl: toAbsoluteUrl(z.titulniFotoUrl, origin),
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
