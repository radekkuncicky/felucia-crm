import { NextRequest, NextResponse } from 'next/server'
import { canAccessDeal } from '@/lib/zakazkyHelpers'
import { forbidden, getPerms } from '@/lib/permissions'
import { checkImageUpload } from '@/lib/uploadSafety'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessDeal(session.user, getPerms(session.user), params.id))) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const deal = await db.deal.findFirst({ where: { id: params.id, orgId } })
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const photos = await db.photo.findMany({
    where: { dealId: params.id, orgId },
    orderBy: { vytvoreno: 'desc' },
  })
  return NextResponse.json(photos)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessDeal(session.user, getPerms(session.user), params.id))) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const deal = await db.deal.findFirst({ where: { id: params.id, orgId } })
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Nepodporovaný formát. Povoleny jsou: JPG, PNG, WEBP, GIF, HEIC.' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Soubor je příliš velký. Maximum je 10 MB.' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', orgId, params.id)
  await mkdir(uploadDir, { recursive: true })

  const img = checkImageUpload(buffer, ['png', 'jpg', 'gif', 'webp', 'heic'])
  if (!img) return NextResponse.json({ error: 'Soubor není podporovaný obrázek' }, { status: 415 })
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${img.ext}`
  const filePath = path.join(uploadDir, filename)
  await writeFile(filePath, buffer)

  const cesta = `/uploads/${orgId}/${params.id}/${filename}`

  const photo = await db.photo.create({
    data: { orgId, dealId: params.id, nazev: file.name, cesta },
  })
  return NextResponse.json(photo)
}
