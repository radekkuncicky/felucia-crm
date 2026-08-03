import { NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { ZamereniFotoTag } from '@prisma/client'

const TAGY = Object.values(ZamereniFotoTag)

type Ctx = { params: { id: string; fotoId: string } }

async function najdiFoto(orgId: string, ctx: Ctx) {
  const db = orgPrisma(orgId)
  const foto = await db.zamereniFoto.findFirst({
    where: { id: ctx.params.fotoId, zamereniId: ctx.params.id },
    include: { zamereni: { select: { stav: true } } },
  })
  return { db, foto }
}

// PATCH /api/mobile/obchod/zamereni/[id]/foto/[fotoId] — tag, popis, pořadí, anotace
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const { db, foto } = await najdiFoto(session!.user.orgId, ctx)
  if (!foto) return NextResponse.json({ error: 'Fotka nenalezena' }, { status: 404 })
  if (foto.zamereni.stav === 'UZAVRENE') {
    return NextResponse.json({ error: 'Uzavřené zaměření nelze upravovat' }, { status: 409 })
  }

  let body: { tag?: string; popis?: string | null; poradi?: number; anotace?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Neplatný požadavek' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (body.tag !== undefined) {
    if (!TAGY.includes(body.tag as ZamereniFotoTag)) {
      return NextResponse.json({ error: 'Neplatný tag' }, { status: 400 })
    }
    data.tag = body.tag
  }
  if (body.popis !== undefined) data.popis = typeof body.popis === 'string' ? body.popis.trim() || null : null
  if (body.poradi !== undefined && Number.isInteger(body.poradi)) data.poradi = body.poradi
  if (body.anotace !== undefined) data.anotace = body.anotace ?? undefined
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Žádná pole ke změně' }, { status: 400 })
  }

  await db.zamereniFoto.update({ where: { id: foto.id }, data })
  return NextResponse.json({ id: foto.id, ok: true })
}

// DELETE /api/mobile/obchod/zamereni/[id]/foto/[fotoId]
export async function DELETE(req: Request, ctx: Ctx) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const { db, foto } = await najdiFoto(session!.user.orgId, ctx)
  if (!foto) return NextResponse.json({ error: 'Fotka nenalezena' }, { status: 404 })
  if (foto.zamereni.stav === 'UZAVRENE') {
    return NextResponse.json({ error: 'Uzavřené zaměření nelze upravovat' }, { status: 409 })
  }

  await db.zamereniFoto.delete({ where: { id: foto.id } })
  if (foto.url.startsWith('/uploads/')) {
    await unlink(join(process.cwd(), 'public', foto.url)).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
