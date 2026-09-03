import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'

// PATCH /api/mobile/obchod/aktivity/[id] — splnění / úprava aktivity.
// { splneno?, vysledek?, popis?, datum?, cas?, reminderAt?, zrusit? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const db = orgPrisma(session!.user.orgId)
  const aktivita = await db.activity.findFirst({
    where: { id: params.id, deal: { orgId: session!.user.orgId } },
  })
  if (!aktivita) return NextResponse.json({ error: 'Aktivita nenalezena' }, { status: 404 })

  let body: {
    splneno?: boolean
    vysledek?: string
    popis?: string
    datum?: string
    cas?: string | null
    reminderAt?: string | null
    zrusit?: boolean
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Neplatný požadavek' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (body.splneno === true) {
    data.splneno = true
    data.stav = 'DOKONCENA'
  } else if (body.splneno === false) {
    data.splneno = false
    data.stav = 'PLANOVANA'
  }
  if (body.zrusit === true) data.stav = 'ZRUSENA'
  if (typeof body.vysledek === 'string') data.vysledek = body.vysledek.trim() || null
  if (typeof body.popis === 'string') data.popis = body.popis.trim() || null
  if (body.datum) data.datum = new Date(body.datum)
  if (body.cas !== undefined) data.cas = body.cas?.trim() || null
  if (body.reminderAt !== undefined) {
    data.reminderAt = body.reminderAt ? new Date(body.reminderAt) : null
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Žádná pole ke změně' }, { status: 400 })
  }

  await db.activity.update({ where: { id: params.id }, data })
  return NextResponse.json({ id: params.id, ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
