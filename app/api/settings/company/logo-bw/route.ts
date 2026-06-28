import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const formData = await req.formData()
  const file = formData.get('logo') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'org', orgId)
  await mkdir(uploadDir, { recursive: true })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const filename = `logo-bw.${ext}`
  const filePath = path.join(uploadDir, filename)
  await writeFile(filePath, buffer)

  const cesta = `/uploads/org/${orgId}/${filename}`
  await db.organization.update({ where: { id: orgId }, data: { logoBw: cesta } })

  return NextResponse.json({ logoBw: cesta })
}
