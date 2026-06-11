import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomBytes } from 'crypto'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB per file

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId, id: userId } = session.user

  const orgSettings = await prisma.orgSettings.findUnique({
    where: { orgId },
    select: { storageLimit: true },
  })
  const storageLimit = orgSettings?.storageLimit ?? BigInt(3 * 1024 * 1024 * 1024)

  const usageAgg = await prisma.document.aggregate({
    where: { orgId },
    _sum: { velikost: true },
  })
  const currentUsage = usageAgg._sum.velikost ?? BigInt(0)

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const popis = formData.get('popis') as string | null

  if (!file) return NextResponse.json({ error: 'Chybí soubor' }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Soubor je příliš velký (max 100 MB)' }, { status: 413 })
  if (currentUsage + BigInt(file.size) > storageLimit) {
    return NextResponse.json({ error: 'Překročen limit úložiště', storageExceeded: true }, { status: 413 })
  }

  const ext = path.extname(file.name) || ''
  const uniqueName = randomBytes(12).toString('hex') + ext
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', orgId, 'documents')
  await mkdir(uploadDir, { recursive: true })

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(uploadDir, uniqueName), buffer)

  const cesta = `/uploads/${orgId}/documents/${uniqueName}`

  const doc = await prisma.document.create({
    data: {
      orgId,
      nazev: file.name,
      originalName: file.name,
      velikost: BigInt(file.size),
      mimeType: file.type || 'application/octet-stream',
      cesta,
      popis: popis || null,
      uploadedById: userId,
    },
  })

  return NextResponse.json({
    id: doc.id,
    nazev: doc.nazev,
    originalName: doc.originalName,
    velikost: doc.velikost.toString(),
    mimeType: doc.mimeType,
    cesta: doc.cesta,
    popis: doc.popis,
    vytvoreno: doc.vytvoreno.toISOString(),
  }, { status: 201 })
}
