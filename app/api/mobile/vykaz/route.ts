import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import {
  getMobileOrWebSession, requireTechnikOrAdmin, canAccessZakazka, canAccessServisniZakazka, type MobileSession,
} from '@/lib/mobile-helpers'
import { VYKAZ_INCLUDE, parseVykazVstup, serializeZaznam } from '@/lib/vykazPrace'

/** Cíl záznamu: právě jedno z zakazkaId / servisniZakazkaId, v rozsahu uživatele */
async function resolveCil(
  session: MobileSession, zakazkaId: unknown, servisniZakazkaId: unknown,
): Promise<{ zakazkaId: string | null; servisniZakazkaId: string | null } | NextResponse> {
  const z = typeof zakazkaId === 'string' && zakazkaId ? zakazkaId : null
  const s = typeof servisniZakazkaId === 'string' && servisniZakazkaId ? servisniZakazkaId : null
  if (!!z === !!s) return NextResponse.json({ error: 'Zadej zakázku nebo servisní výjezd' }, { status: 400 })
  const ok = z ? await canAccessZakazka(session, z) : await canAccessServisniZakazka(session, s!)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return { zakazkaId: z, servisniZakazkaId: s }
}

// GET /api/mobile/vykaz?zakazkaId=… | ?servisniZakazkaId=… — moje záznamy na zakázce
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  const sp = new URL(req.url).searchParams
  const cil = await resolveCil(session!, sp.get('zakazkaId'), sp.get('servisniZakazkaId'))
  if (cil instanceof NextResponse) return cil

  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)
  const [zaznamy, user] = await Promise.all([
    db.vykazPrace.findMany({
      where: { orgId, userId, ...(cil.zakazkaId ? { zakazkaId: cil.zakazkaId } : { servisniZakazkaId: cil.servisniZakazkaId }) },
      include: VYKAZ_INCLUDE,
      orderBy: [{ datum: 'desc' }, { vytvoreno: 'desc' }],
    }),
    db.user.findFirst({ where: { id: userId, orgId }, select: { sazbaHodina: true, sazbaKm: true } }),
  ])

  return NextResponse.json({
    zaznamy: zaznamy.map(serializeZaznam),
    sazby: {
      sazbaHodina: user?.sazbaHodina == null ? null : Number(user.sazbaHodina),
      sazbaKm: user?.sazbaKm == null ? null : Number(user.sazbaKm),
    },
  })
}

// POST /api/mobile/vykaz — nový výjezd (hodiny+km) nebo položka (popis+částka)
export async function POST(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const cil = await resolveCil(session!, body.zakazkaId, body.servisniZakazkaId)
  if (cil instanceof NextResponse) return cil

  const vstup = parseVykazVstup(body)
  if (typeof vstup === 'string') return NextResponse.json({ error: vstup }, { status: 400 })

  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)

  let sazbaHodina: number | null = null
  let sazbaKm: number | null = null
  if (vstup.typ === 'VYJEZD') {
    const user = await db.user.findFirst({ where: { id: userId, orgId }, select: { sazbaHodina: true, sazbaKm: true } })
    const needH = vstup.hodiny > 0 && user?.sazbaHodina == null
    const needKm = vstup.km > 0 && user?.sazbaKm == null
    if (needH || needKm) {
      return NextResponse.json({ error: 'Nejdřív si v Nastavení (Já) vyplň svoje sazby', kod: 'CHYBI_SAZBY' }, { status: 400 })
    }
    sazbaHodina = user?.sazbaHodina == null ? null : Number(user.sazbaHodina)
    sazbaKm = user?.sazbaKm == null ? null : Number(user.sazbaKm)
  }

  const zaznam = await db.vykazPrace.create({
    data: {
      orgId, userId, ...cil,
      typ: vstup.typ, datum: vstup.datum, hodiny: vstup.hodiny, km: vstup.km,
      sazbaHodina, sazbaKm, popis: vstup.popis, castka: vstup.castka, poznamka: vstup.poznamka,
    },
    include: VYKAZ_INCLUDE,
  })
  return NextResponse.json(serializeZaznam(zaznam), { status: 201 })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
