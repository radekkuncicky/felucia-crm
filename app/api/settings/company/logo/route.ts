import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId

  const formData = await req.formData()
  const file = formData.get('logo') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'org', orgId)
  await mkdir(uploadDir, { recursive: true })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const filename = `logo.${ext}`
  const filePath = path.join(uploadDir, filename)
  await writeFile(filePath, buffer)

  const cesta = `/uploads/org/${orgId}/${filename}`
  await prisma.organization.update({ where: { id: orgId }, data: { logo: cesta } })

  return NextResponse.json({ logo: cesta })
}
