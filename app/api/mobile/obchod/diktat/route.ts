import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { DIKTAT_WHERE, parseDiktatText, parseDiktatDatum } from '@/lib/diktat'
import { dnesPraha } from '@/lib/datumPraha'
import { idempotentne, parseMobileId, MobileIdKolize } from '@/lib/mobileIdempotence'

// GET /api/mobile/obchod/diktat — moje nezpracované diktáty (bez OP i leadu)
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr
  const { orgId, id: userId } = session!.user
  const diktaty = await orgPrisma(orgId).activity.findMany({
    where: { ...DIKTAT_WHERE, userId, stav: 'PLANOVANA' },
    orderBy: { vytvoreno: 'desc' },
    take: 50,
    select: { id: true, popis: true, vytvoreno: true },
  })
  return NextResponse.json(diktaty.map(d => ({ id: d.id, text: d.popis ?? '', vytvoreno: d.vytvoreno })))
}

// POST /api/mobile/obchod/diktat — { text, mobileId? } diktát bez OP (zápis z Dnes);
// úkol na dnešek, připojí se později k OP (pripojit) — stejný mechanismus jako web/Dáša
export async function POST(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr
  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)

  const body = await req.json().catch(() => ({})) as { text?: unknown; mobileId?: unknown }
  const text = parseDiktatText(body.text)
  if (!text) return NextResponse.json({ error: 'Diktát je prázdný' }, { status: 400 })
  const mobileId = parseMobileId(body.mobileId)

  try {
    const { zaznam, novy } = await idempotentne(
      mobileId,
      m => db.activity.findFirst({ where: { mobileId: m }, select: { id: true } }),
      () => db.activity.create({
        data: {
          orgId, userId, resitelId: userId, typ: 'UKOL', stav: 'PLANOVANA',
          popis: text, cil: 'Zpracovat diktát', datum: parseDiktatDatum(dnesPraha())!, mobileId,
        },
        select: { id: true },
      }),
    )
    return NextResponse.json({ id: zaznam.id }, { status: novy ? 201 : 200 })
  } catch (e) {
    if (e instanceof MobileIdKolize) return NextResponse.json({ error: 'Neplatné mobileId' }, { status: 422 })
    throw e
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
