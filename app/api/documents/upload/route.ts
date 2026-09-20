import { getServerSession } from 'next-auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { checkDocumentUpload } from '@/lib/uploadSafety'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomBytes } from 'crypto'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB per file

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).obchod) return forbidden()

  const { orgId, id: userId } = session.user
  const db = orgPrisma(orgId)

  const orgSettings = await db.orgSettings.findUnique({
    where: { orgId },
    select: { storageLimit: true },
  })
  const storageLimit = orgSettings?.storageLimit ?? BigInt(3 * 1024 * 1024 * 1024)

  const usageAgg = await db.document.aggregate({
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

  const buffer = Buffer.from(await file.arrayBuffer())
  // Přípona jen z whitelistu a podle obsahu — /uploads se servíruje podle přípony (XSS přes .html/.svg)
  const check = checkDocumentUpload(buffer, file.name)
  if (!check) return NextResponse.json({ error: 'Nepodporovaný typ souboru' }, { status: 415 })
  const uniqueName = randomBytes(12).toString('hex') + '.' + check.ext
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', orgId, 'documents')
  await mkdir(uploadDir, { recursive: true })

  await writeFile(path.join(uploadDir, uniqueName), buffer)

  const cesta = `/uploads/${orgId}/documents/${uniqueName}`

  const doc = await db.document.create({
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
