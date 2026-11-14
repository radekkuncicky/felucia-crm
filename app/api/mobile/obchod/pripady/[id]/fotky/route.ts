import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { mobileDealScope, getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { nactiFotkyOp, fotkaProAppku, originZ } from '@/lib/fotkyOp'
import { ulozFotkuOp, smazSouborFotky, FOTO_MAX_BYTES } from '@/lib/fotoUloziste'
import { parseStitek } from '@/lib/fotoStitky'
import { idempotentne, parseMobileId, MobileIdKolize } from '@/lib/mobileIdempotence'

function souradnice(v: FormDataEntryValue | null, max: number): number | null {
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null
}

// GET /api/mobile/obchod/pripady/[id]/fotky — galerie OP (fotky k OP + ze zaměření)
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const db = orgPrisma(session!.user.orgId)
  const deal = await db.deal.findFirst({ where: { id: params.id, ...mobileDealScope(session!) }, select: { id: true } })
  if (!deal) return NextResponse.json({ error: 'Případ nenalezen' }, { status: 404 })

  const origin = originZ(req)
  return NextResponse.json((await nactiFotkyOp(db, deal.id)).map(f => fotkaProAppku(f, origin)))
}

// POST /api/mobile/obchod/pripady/[id]/fotky — multipart: foto, mobileId?, tag?, popis?, gpsLat?, gpsLng?
// Opakovaný mobileId (offline fronta) vrátí už uloženou fotku (200).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)
  const deal = await db.deal.findFirst({ where: { id: params.id, ...mobileDealScope(session!) }, select: { id: true } })
  if (!deal) return NextResponse.json({ error: 'Případ nenalezen' }, { status: 404 })

  if (!(req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Očekávám multipart/form-data' }, { status: 415 })
  }
  let form: FormData
  try { form = await req.formData() } catch {
    return NextResponse.json({ error: 'Neplatná form data' }, { status: 400 })
  }

  const mobileId = parseMobileId(form.get('mobileId'))
  const origin = originZ(req)
  const najdi = (m: string) => db.photo.findFirst({ where: { mobileId: m, dealId: deal.id } })

  // fotka už je nahraná (opakované odeslání) — soubor se znovu neukládá
  if (mobileId) {
    const uz = await najdi(mobileId)
    if (uz) {
      const [f] = (await nactiFotkyOp(db, deal.id)).filter(x => x.id === uz.id)
      return NextResponse.json(f ? fotkaProAppku(f, origin) : { id: uz.id }, { status: 200 })
    }
  }

  const file = form.get('foto')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Chybí pole foto' }, { status: 400 })
  if (file.size > FOTO_MAX_BYTES) return NextResponse.json({ error: 'Soubor je příliš velký (max 10 MB)' }, { status: 413 })

  const ulozeni = await ulozFotkuOp(orgId, deal.id, Buffer.from(await file.arrayBuffer()))
  if (!ulozeni.ok) return NextResponse.json({ error: ulozeni.error }, { status: ulozeni.status })

  const gpsLat = souradnice(form.get('gpsLat'), 90)
  const gpsLng = souradnice(form.get('gpsLng'), 180)
  const popis = String(form.get('popis') ?? '').trim().slice(0, 500) || null

  try {
    const { zaznam, novy } = await idempotentne(mobileId, najdi, () => db.photo.create({
      data: {
        orgId,
        dealId: deal.id,
        nazev: file.name || 'foto.jpg',
        cesta: ulozeni.cesta,
        tag: parseStitek(form.get('tag')),
        popis,
        gpsLat: gpsLat !== null && gpsLng !== null ? gpsLat : null,
        gpsLng: gpsLat !== null && gpsLng !== null ? gpsLng : null,
        autorId: userId,
        mobileId,
      },
    }))
    if (!novy) await smazSouborFotky(ulozeni.cesta) // souběh — druhý soubor je navíc
    const [f] = (await nactiFotkyOp(db, deal.id)).filter(x => x.id === zaznam.id)
    return NextResponse.json(fotkaProAppku(f, origin), { status: novy ? 201 : 200 })
  } catch (e) {
    await smazSouborFotky(ulozeni.cesta)
    if (e instanceof MobileIdKolize) return NextResponse.json({ error: 'Neplatné mobileId' }, { status: 422 })
    throw e
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
