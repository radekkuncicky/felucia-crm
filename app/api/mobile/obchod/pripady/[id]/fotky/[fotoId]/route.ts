import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { mobileDealScope, getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { parseStitek } from '@/lib/fotoStitky'
import { smazSouborFotky } from '@/lib/fotoUloziste'

type Nalez =
  | { err: NextResponse }
  | { db: ReturnType<typeof orgPrisma>; foto: { id: string; cesta: string } }

async function najdiFotku(req: Request, params: { id: string; fotoId: string }): Promise<Nalez> {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return { err: authErr }
  const db = orgPrisma(session!.user.orgId)
  const deal = await db.deal.findFirst({ where: { id: params.id, ...mobileDealScope(session!) }, select: { id: true } })
  if (!deal) return { err: NextResponse.json({ error: 'Případ nenalezen' }, { status: 404 }) }
  // jen fotky k OP — fotky zaměření se upravují v zaměření (anotace, povinné tagy)
  const foto = await db.photo.findFirst({ where: { id: params.fotoId, dealId: deal.id } })
  if (!foto) return { err: NextResponse.json({ error: 'Fotka nenalezena' }, { status: 404 }) }
  return { db, foto }
}

// PATCH /api/mobile/obchod/pripady/[id]/fotky/[fotoId] — { tag?, popis? }
export async function PATCH(req: Request, { params }: { params: { id: string; fotoId: string } }) {
  const r = await najdiFotku(req, params)
  if ('err' in r) return r.err
  let body: { tag?: unknown; popis?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Neplatný požadavek' }, { status: 400 })
  }
  const data: { tag?: string | null; popis?: string | null } = {}
  if (body.tag !== undefined) data.tag = body.tag === null ? null : parseStitek(body.tag)
  if (body.popis !== undefined) data.popis = typeof body.popis === 'string' ? body.popis.trim().slice(0, 500) || null : null
  const f = await r.db.photo.update({ where: { id: r.foto.id }, data })
  return NextResponse.json({ id: f.id, tag: f.tag, popis: f.popis })
}

// DELETE /api/mobile/obchod/pripady/[id]/fotky/[fotoId]
export async function DELETE(req: Request, { params }: { params: { id: string; fotoId: string } }) {
  const r = await najdiFotku(req, params)
  if ('err' in r) return r.err
  await r.db.photo.delete({ where: { id: r.foto.id } })
  await smazSouborFotky(r.foto.cesta)
  return NextResponse.json({ ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
