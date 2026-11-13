import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin } from '@/lib/mobile-helpers'
import { signVykazPdfUrl, souctyVykazu } from '@/lib/vykazPrace'

// POST /api/mobile/vykaz/vyfakturovat { ids: string[] }
// Uzavře PŘEDANÉ nevyfakturované záznamy (to, co technik viděl v náhledu) do nové VykazFakturace.
// Záznam zapsaný mezitím (jiné zařízení/outbox) zůstane nevyfakturovaný do příště.
export async function POST(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  let body: { ids?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : []
  if (ids.length === 0) return NextResponse.json({ error: 'Není co vyfakturovat' }, { status: 400 })
  if (ids.length > 2000) return NextResponse.json({ error: 'Příliš mnoho záznamů' }, { status: 400 })

  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)

  const result = await db.$transaction(async tx => {
    const zaznamy = await tx.vykazPrace.findMany({
      where: { id: { in: ids }, orgId, userId, fakturaceId: null },
      orderBy: { datum: 'asc' },
    })
    if (zaznamy.length === 0) return null
    const s = souctyVykazu(zaznamy)
    const posledni = await tx.vykazFakturace.findFirst({ where: { orgId, userId }, orderBy: { cislo: 'desc' }, select: { cislo: true } })
    const fakturace = await tx.vykazFakturace.create({
      data: {
        orgId, userId,
        cislo: (posledni?.cislo ?? 0) + 1,
        obdobiOd: zaznamy[0].datum,
        obdobiDo: zaznamy[zaznamy.length - 1].datum,
        hodinyCelkem: s.hodiny,
        kmCelkem: s.km,
        castkaCelkem: s.castka,
      },
    })
    const upd = await tx.vykazPrace.updateMany({
      where: { id: { in: zaznamy.map(z => z.id) }, orgId, userId, fakturaceId: null },
      data: { fakturaceId: fakturace.id },
    })
    // souběžná úprava/smazání mezi čtením a zápisem → celé znovu
    if (upd.count !== zaznamy.length) throw new Error('VYKAZ_SOUBEH')
    return { fakturace, soucty: s }
  }).catch((e: unknown) => {
    if (e instanceof Error && e.message === 'VYKAZ_SOUBEH') return 'soubeh' as const
    // @@unique([userId, cislo]) — dvojklik / dvě zařízení najednou
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') return 'soubeh' as const
    throw e
  })

  if (result === 'soubeh') return NextResponse.json({ error: 'Záznamy se mezitím změnily — obnov přehled a zkus to znovu' }, { status: 409 })
  if (!result) return NextResponse.json({ error: 'Záznamy už jsou vyfakturované' }, { status: 409 })

  const f = result.fakturace
  return NextResponse.json({
    id: f.id,
    cislo: f.cislo,
    obdobiOd: f.obdobiOd.toISOString().slice(0, 10),
    obdobiDo: f.obdobiDo.toISOString().slice(0, 10),
    hodiny: Number(f.hodinyCelkem),
    km: f.kmCelkem,
    castka: Number(f.castkaCelkem),
    pdfUrl: signVykazPdfUrl(userId, f.id),
  }, { status: 201 })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
