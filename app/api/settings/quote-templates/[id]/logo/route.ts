import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const template = await db.quoteTemplate.findFirst({ where: { id: params.id, orgId } })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('logo') as File | null
  if (!file) return NextResponse.json({ error: 'Soubor chybí' }, { status: 400 })

  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Soubor musí být obrázek' }, { status: 400 })
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: 'Logo nesmí být větší než 2 MB' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'png'
  const fileName = `logo-${params.id}.${ext}`
  const dir = path.join(process.cwd(), 'public', 'uploads', 'logos')
  await fs.mkdir(dir, { recursive: true })
  const filePath = path.join(dir, fileName)
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(filePath, buffer)

  const logoUrl = `/uploads/logos/${fileName}`

  await db.quoteTemplateConfig.upsert({
    where: { templateId: params.id },
    create: { templateId: params.id, logoUrl },
    update: { logoUrl },
  })

  return NextResponse.json({ logoUrl })
}
