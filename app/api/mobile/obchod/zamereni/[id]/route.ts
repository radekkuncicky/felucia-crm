import { NextResponse } from 'next/server'
import { rm } from 'fs/promises'
import { join } from 'path'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin, toAbsoluteUrl } from '@/lib/mobile-helpers'
import { getDefiniceProZamereni, getAktivniDefinice, chybejiciTagy } from '@/lib/zamereniDefinice'
import { Technologie } from '@prisma/client'

function reqOrigin(req: Request): string {
  const host = req.headers.get('host') ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  return host ? `${proto}://${host}` : new URL(req.url).origin
}

// GET /api/mobile/obchod/zamereni/[id] — detail s fotkami a definicí formuláře
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const db = orgPrisma(session!.user.orgId)
  const zamereni = await db.zamereni.findFirst({
    where: { id: params.id },
    include: {
      fotky: { orderBy: [{ poradi: 'asc' }, { vytvoreno: 'asc' }] },
      autor: { select: { id: true, jmeno: true } },
      deal: { select: { id: true, kod: true, predmet: true } },
    },
  })
  if (!zamereni) return NextResponse.json({ error: 'Zaměření nenalezeno' }, { status: 404 })

  const definice = await getDefiniceProZamereni(db, zamereni)
  const origin = reqOrigin(req)

  return NextResponse.json({
    id: zamereni.id,
    typ: zamereni.typ,
    stav: zamereni.stav,
    datum: zamereni.datum,
    gpsLat: zamereni.gpsLat,
    gpsLng: zamereni.gpsLng,
    odpovedi: zamereni.odpovedi,
    autor: zamereni.autor ? { id: zamereni.autor.id, jmeno: zamereni.autor.jmeno } : null,
    pripad: zamereni.deal,
    definice,
    chybejiciTagy: chybejiciTagy(definice.povinneTagy, zamereni.fotky),
    fotky: zamereni.fotky.map(f => ({
      id: f.id,
      url: toAbsoluteUrl(f.url, origin),
      tag: f.tag,
      popis: f.popis,
      poradi: f.poradi,
      gpsLat: f.gpsLat,
      gpsLng: f.gpsLng,
      anotace: f.anotace,
      vytvoreno: f.vytvoreno,
    })),
  })
}

// PATCH /api/mobile/obchod/zamereni/[id] — odpovědi (merge), GPS, datum, typ.
// Jen rozpracované zaměření; uzavřené je zamčené.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const db = orgPrisma(session!.user.orgId)
  const zamereni = await db.zamereni.findFirst({ where: { id: params.id } })
  if (!zamereni) return NextResponse.json({ error: 'Zaměření nenalezeno' }, { status: 404 })
  if (zamereni.stav === 'UZAVRENE') {
    return NextResponse.json({ error: 'Uzavřené zaměření nelze upravovat' }, { status: 409 })
  }

  let body: {
    odpovedi?: Record<string, unknown>
    gpsLat?: number | null
    gpsLng?: number | null
    datum?: string
    typ?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Neplatný požadavek' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (body.odpovedi && typeof body.odpovedi === 'object') {
    // Merge — appka posílá jen změněná pole (offline fronta po sekcích)
    data.odpovedi = { ...(zamereni.odpovedi as Record<string, unknown>), ...body.odpovedi }
  }
  if (body.gpsLat !== undefined) data.gpsLat = body.gpsLat
  if (body.gpsLng !== undefined) data.gpsLng = body.gpsLng
  if (body.datum) data.datum = new Date(body.datum)
  if (body.typ && Object.values(Technologie).includes(body.typ as Technologie) && body.typ !== zamereni.typ) {
    // Změna typu = jiný formulář; rovnou zafixujeme aktuální definici nového typu
    const definice = await getAktivniDefinice(db, body.typ as Technologie)
    data.typ = body.typ
    data.definiceId = definice.id
    data.definiceVerze = definice.verze
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Žádná pole ke změně' }, { status: 400 })
  }

  await db.zamereni.update({ where: { id: params.id }, data })
  return NextResponse.json({ id: params.id, ok: true })
}

// DELETE /api/mobile/obchod/zamereni/[id] — jen rozpracované; smaže i soubory fotek
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const db = orgPrisma(session!.user.orgId)
  const zamereni = await db.zamereni.findFirst({ where: { id: params.id } })
  if (!zamereni) return NextResponse.json({ error: 'Zaměření nenalezeno' }, { status: 404 })
  if (zamereni.stav === 'UZAVRENE') {
    return NextResponse.json({ error: 'Uzavřené zaměření nelze smazat' }, { status: 409 })
  }

  await db.zamereni.delete({ where: { id: params.id } })
  // Soubory na disku: best-effort, DB je zdroj pravdy
  await rm(join(process.cwd(), 'public', 'uploads', 'zamereni', params.id), { recursive: true, force: true }).catch(() => {})

  return NextResponse.json({ ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
