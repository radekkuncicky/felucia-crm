import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { orgPrisma } from '@/lib/orgPrisma'
import { mobileDealScope, getMobileOrWebSession, requireObchodnikOrAdmin, toAbsoluteUrl } from '@/lib/mobile-helpers'
import { ZamereniFotoTag } from '@prisma/client'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_FILES = 10
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
const TAGY = Object.values(ZamereniFotoTag)

// POST /api/mobile/obchod/zamereni/[id]/foto — upload fotek (multipart).
// Pole `foto` (1..N souborů), volitelně tag, popis, gpsLat, gpsLng — platí
// pro všechny soubory v dávce. Appka komprimuje před uploadem (1600px).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId } = session!.user
  const db = orgPrisma(orgId)
  const zamereni = await db.zamereni.findFirst({ where: { id: params.id, deal: mobileDealScope(session!) }, select: { id: true, stav: true } })
  if (!zamereni) return NextResponse.json({ error: 'Zaměření nenalezeno' }, { status: 404 })
  if (zamereni.stav === 'UZAVRENE') {
    return NextResponse.json({ error: 'Uzavřené zaměření nelze upravovat' }, { status: 409 })
  }

  if (!(req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Očekávám multipart/form-data' }, { status: 415 })
  }

  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: 'Neplatná form data' }, { status: 400 })
  }

  const files = formData.getAll('foto').filter((f): f is File => f instanceof File)
  if (files.length === 0) return NextResponse.json({ error: 'Chybí pole foto' }, { status: 400 })
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximálně ${MAX_FILES} fotek v jedné dávce` }, { status: 400 })
  }

  for (const file of files) {
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Soubor je příliš velký (max 10 MB)' }, { status: 413 })
    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      return NextResponse.json({ error: 'Nepodporovaný formát (jpg, png, heic, webp)' }, { status: 415 })
    }
  }

  const rawTag = String(formData.get('tag') ?? '')
  const tag = (TAGY.includes(rawTag as ZamereniFotoTag) ? rawTag : 'JINE') as ZamereniFotoTag
  const popis = String(formData.get('popis') ?? '').trim() || null
  const gpsLat = formData.get('gpsLat') ? Number(formData.get('gpsLat')) : null
  const gpsLng = formData.get('gpsLng') ? Number(formData.get('gpsLng')) : null

  const dir = join(process.cwd(), 'public', 'uploads', 'zamereni', params.id)
  await mkdir(dir, { recursive: true })

  const posledni = await db.zamereniFoto.findFirst({
    where: { zamereniId: params.id },
    orderBy: { poradi: 'desc' },
    select: { poradi: true },
  })
  let poradi = (posledni?.poradi ?? -1) + 1

  const host = req.headers.get('host') ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const origin = host ? `${proto}://${host}` : new URL(req.url).origin

  const vysledky = []
  for (const file of files) {
    const ext = file.type.includes('png') ? 'png'
      : file.type.includes('heic') || file.type.includes('heif') ? 'heic' : 'jpg'
    const filename = `${Date.now()}-${poradi}.${ext}`
    await writeFile(join(dir, filename), Buffer.from(await file.arrayBuffer()))
    const url = `/uploads/zamereni/${params.id}/${filename}`

    const foto = await db.zamereniFoto.create({
      data: {
        orgId,
        zamereniId: params.id,
        url,
        tag,
        popis,
        poradi,
        gpsLat: Number.isFinite(gpsLat) ? gpsLat : null,
        gpsLng: Number.isFinite(gpsLng) ? gpsLng : null,
      },
    })
    vysledky.push({ id: foto.id, url: toAbsoluteUrl(url, origin), tag, poradi })
    poradi += 1
  }

  return NextResponse.json({ fotky: vysledky }, { status: 201 })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
