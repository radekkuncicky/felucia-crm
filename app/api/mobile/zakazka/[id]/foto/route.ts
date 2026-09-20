import { NextResponse } from 'next/server'
import { signUploadUrl } from '@/lib/uploadSign'
import { checkImageUpload, isImageDataUri } from '@/lib/uploadSafety'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, canAccessZakazka } from '@/lib/mobile-helpers'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif', 'image/webp']

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  if (!(await canAccessZakazka(session!, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const contentType = req.headers.get('content-type') ?? ''

  // Multipart upload (from native iOS app)
  if (contentType.includes('multipart/form-data')) {
    let formData: FormData
    try { formData = await req.formData() } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }

    const file = formData.get('foto') as File | null
    if (!file) return NextResponse.json({ error: 'Chybí pole foto' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Soubor je příliš velký (max 10 MB)' }, { status: 413 })
    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      return NextResponse.json({ error: 'Nepodporovaný formát (jpg, png, heic, webp)' }, { status: 415 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Přípona podle skutečného obsahu (magic bytes), ne podle Content-Type od klienta
    const img = checkImageUpload(buffer, ['png', 'jpg', 'webp', 'heic'])
    if (!img) return NextResponse.json({ error: 'Soubor není podporovaný obrázek (jpg, png, heic, webp)' }, { status: 415 })
    const ext = img.ext
    const timestamp = Date.now()
    const filename = `${timestamp}.${ext}`
    const dir = join(process.cwd(), 'public', 'uploads', 'zakazky', params.id)

    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, filename), buffer)

    const url = `/uploads/zakazky/${params.id}/${filename}`
    const popis = formData.get('popis') as string | null

    const foto = await orgPrisma(session!.user.orgId).zakazkaFoto.create({
      data: { zakazkaId: params.id, url, popis: popis ?? null, nahralId: session!.user.id },
    })

    // Podepsaný odkaz — /uploads vyžaduje autorizaci a RN Image nemá cookie
    return NextResponse.json({ id: foto.id, url: signUploadUrl(url), popis: foto.popis, vytvoreno: foto.vytvoreno }, { status: 201 })
  }

  // JSON base64 fallback (web app compatibility)
  if (contentType.includes('application/json')) {
    let body: { url?: string; popis?: string }
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
    if (!body.url) return NextResponse.json({ error: 'Chybí url' }, { status: 400 })
    if (!isImageDataUri(body.url)) return NextResponse.json({ error: 'Neplatný formát obrázku' }, { status: 400 })

    const foto = await orgPrisma(session!.user.orgId).zakazkaFoto.create({
      data: { zakazkaId: params.id, url: body.url, popis: body.popis ?? null, nahralId: session!.user.id },
    })
    return NextResponse.json({ id: foto.id, url: foto.url, popis: foto.popis, vytvoreno: foto.vytvoreno }, { status: 201 })
  }

  return NextResponse.json({ error: 'Nepodporovaný content-type' }, { status: 415 })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
