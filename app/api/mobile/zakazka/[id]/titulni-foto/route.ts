import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, canAccessZakazka } from '@/lib/mobile-helpers'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif', 'image/webp']

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  if (!(await canAccessZakazka(session!, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const contentType = req.headers.get('content-type') ?? ''
  const db = orgPrisma(session!.user.orgId)

  if (contentType.includes('multipart/form-data')) {
    let formData: FormData
    try { formData = await req.formData() } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }

    const file = formData.get('foto') as File | null
    if (!file) return NextResponse.json({ error: 'Chybí pole foto' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Soubor je příliš velký (max 10 MB)' }, { status: 413 })
    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      return NextResponse.json({ error: 'Nepodporovaný formát' }, { status: 415 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const ext = file.type.includes('png') ? 'png' : 'jpg'
    const filename = `titulni_${Date.now()}.${ext}`
    const dir = join(process.cwd(), 'public', 'uploads', 'zakazky', params.id)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, filename), buffer)

    const url = `/uploads/zakazky/${params.id}/${filename}`
    await db.zakazka.update({ where: { id: params.id }, data: { titulniFotoUrl: url } })
    return NextResponse.json({ titulniFotoUrl: url })
  }

  // JSON base64 (web)
  if (contentType.includes('application/json')) {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'Chybí URL' }, { status: 400 })
    await db.zakazka.update({ where: { id: params.id }, data: { titulniFotoUrl: url } })
    return NextResponse.json({ titulniFotoUrl: url })
  }

  return NextResponse.json({ error: 'Nepodporovaný content-type' }, { status: 415 })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
