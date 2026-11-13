import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin } from '@/lib/mobile-helpers'
import { VYKAZ_INCLUDE, parseVykazVstup, serializeZaznam } from '@/lib/vykazPrace'

type Ctx = { params: { id: string } }

/** Vlastní záznam; vyfakturovaný je zamčený (409) */
async function nactiVlastni(req: Request, id: string) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr || !session) return { err: authErr ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { orgId, id: userId } = session.user
  const db = orgPrisma(orgId)
  const zaznam = await db.vykazPrace.findFirst({ where: { id, orgId, userId } })
  if (!zaznam) return { err: NextResponse.json({ error: 'Záznam nenalezen' }, { status: 404 }) }
  if (zaznam.fakturaceId) {
    return { err: NextResponse.json({ error: 'Záznam je už vyfakturovaný — nejde měnit' }, { status: 409 }) }
  }
  return { db, zaznam, orgId, userId }
}

// PATCH /api/mobile/vykaz/[id] — úprava (typ se nemění; sazby zůstávají ze zápisu)
export async function PATCH(req: Request, { params }: Ctx) {
  const r = await nactiVlastni(req, params.id)
  if (r.err) return r.err
  const { db, zaznam, orgId, userId } = r

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const vstup = parseVykazVstup({ ...body, typ: zaznam.typ })
  if (typeof vstup === 'string') return NextResponse.json({ error: vstup }, { status: 400 })

  let sazbaHodina = zaznam.sazbaHodina == null ? null : Number(zaznam.sazbaHodina)
  let sazbaKm = zaznam.sazbaKm == null ? null : Number(zaznam.sazbaKm)
  if (vstup.typ === 'VYJEZD' && (sazbaHodina == null || sazbaKm == null)) {
    // záznam vznikl bez dané sazby → doplnit aktuální sazbu technika (pokud ji firma už nastavila)
    const user = await db.user.findFirst({ where: { id: userId, orgId }, select: { sazbaHodina: true, sazbaKm: true } })
    sazbaHodina ??= user?.sazbaHodina == null ? null : Number(user.sazbaHodina)
    sazbaKm ??= user?.sazbaKm == null ? null : Number(user.sazbaKm)
  }

  // updateMany s podmínkou fakturaceId: null — souběh s „Vyfakturováno“ nesmí změnit uzavřený záznam
  const res = await db.vykazPrace.updateMany({
    where: { id: zaznam.id, orgId, userId, fakturaceId: null },
    data: {
      datum: vstup.datum, hodiny: vstup.hodiny, km: vstup.km, sazbaHodina, sazbaKm,
      popis: vstup.popis, castka: vstup.castka, poznamka: vstup.poznamka,
    },
  })
  if (res.count === 0) return NextResponse.json({ error: 'Záznam je už vyfakturovaný — nejde měnit' }, { status: 409 })

  const updated = await db.vykazPrace.findFirstOrThrow({ where: { id: zaznam.id, orgId }, include: VYKAZ_INCLUDE })
  return NextResponse.json(serializeZaznam(updated))
}

// DELETE /api/mobile/vykaz/[id]
export async function DELETE(req: Request, { params }: Ctx) {
  const r = await nactiVlastni(req, params.id)
  if (r.err) return r.err
  const { db, zaznam, orgId, userId } = r
  const res = await db.vykazPrace.deleteMany({ where: { id: zaznam.id, orgId, userId, fakturaceId: null } })
  if (res.count === 0) return NextResponse.json({ error: 'Záznam je už vyfakturovaný — nejde smazat' }, { status: 409 })
  return NextResponse.json({ ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
