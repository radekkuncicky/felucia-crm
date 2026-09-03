import { NextResponse } from 'next/server'
import { ZakazkaStav } from '@prisma/client'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin, toAbsoluteUrl } from '@/lib/mobile-helpers'

const HOTOVE_STAVY: ZakazkaStav[] = ['PREDANA', 'VYUCTOVANA', 'HOTOVO']

/**
 * GET /api/mobile/obchod/reference?technologie=KLIMA — referenční galerie
 * pro schůzku u klienta: fotky z dokončených zakázek. Záměrně bez jmen
 * klientů (jen město) — obchodník ukazuje cizím lidem.
 */
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const db = orgPrisma(session!.user.orgId)
  const technologie = new URL(req.url).searchParams.get('technologie')

  const zakazky = await db.zakazka.findMany({
    where: {
      stav: { in: HOTOVE_STAVY },
      ...(technologie ? { technologie } : {}),
      OR: [{ fotky: { some: {} } }, { titulniFotoUrl: { not: null } }],
    },
    select: {
      id: true,
      nazev: true,
      technologie: true,
      titulniFotoUrl: true,
      updatedAt: true,
      klient: { select: { mesto: true } },
      fotky: { select: { url: true, popis: true }, orderBy: { vytvoreno: 'asc' }, take: 10 },
    },
    orderBy: { updatedAt: 'desc' },
    take: 30,
  })

  const host = req.headers.get('host') ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const origin = host ? `${proto}://${host}` : new URL(req.url).origin

  return NextResponse.json(zakazky.map(z => {
    const fotky = z.fotky.map(f => ({ url: toAbsoluteUrl(f.url, origin)!, popis: f.popis }))
    const titulni = z.titulniFotoUrl ? toAbsoluteUrl(z.titulniFotoUrl, origin) : null
    return {
      id: z.id,
      nazev: z.nazev,
      technologie: z.technologie,
      mesto: z.klient?.mesto ?? null,
      dokonceno: z.updatedAt,
      titulniFoto: titulni ?? fotky[0]?.url ?? null,
      fotky,
    }
  }))
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
