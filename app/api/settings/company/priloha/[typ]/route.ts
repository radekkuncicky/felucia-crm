import { getServerSession } from 'next-auth'
import { isPdf } from '@/lib/uploadSafety'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getPerms } from '@/lib/permissions'

const ALLOWED_TYPES = ['vop', 'vzsp', 'cenik'] as const
type AttachType = typeof ALLOWED_TYPES[number]

const DB_FIELD: Record<AttachType, 'prilohaVopPath' | 'prilohaVzspPath' | 'prilohaCenikPath'> = {
  vop:   'prilohaVopPath',
  vzsp:  'prilohaVzspPath',
  cenik: 'prilohaCenikPath',
}

export async function POST(req: Request, { params }: { params: { typ: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).nastaveniOrg) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const typ = params.typ as AttachType
  if (!ALLOWED_TYPES.includes(typ)) {
    return NextResponse.json({ error: 'Neznámý typ přílohy' }, { status: 400 })
  }

  const orgId = session.user.orgId
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Chybí soubor' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Soubor je příliš velký (max 10 MB)' }, { status: 413 })
  }
  const buf = Buffer.from(await file.arrayBuffer())
  // Obsah, ne Content-Type — soubor pak jde do pdfunite/Chromia při generování SOD
  if (!isPdf(buf)) {
    return NextResponse.json({ error: 'Soubor musí být PDF' }, { status: 400 })
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', 'org', orgId)
  fs.mkdirSync(dir, { recursive: true })

  const dest = path.join(dir, `priloha-${typ}.pdf`)
  fs.writeFileSync(dest, buf)

  const relativePath = `/uploads/org/${orgId}/priloha-${typ}.pdf`
  await prisma.organization.update({
    where: { id: orgId },
    data: { [DB_FIELD[typ]]: relativePath },
  })

  return NextResponse.json({ path: relativePath })
}

export async function DELETE(req: Request, { params }: { params: { typ: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).nastaveniOrg) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const typ = params.typ as AttachType
  if (!ALLOWED_TYPES.includes(typ)) {
    return NextResponse.json({ error: 'Neznámý typ' }, { status: 400 })
  }

  const orgId = session.user.orgId
  const field = DB_FIELD[typ]
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { prilohaVopPath: true, prilohaVzspPath: true, prilohaCenikPath: true },
  })
  const filePath: string | null = org?.[field] ?? null

  if (filePath) {
    const abs = path.join(process.cwd(), 'public', filePath)
    try { fs.unlinkSync(abs) } catch { /* ignore if not found */ }
  }

  await prisma.organization.update({ where: { id: orgId }, data: { [field]: null } })
  return NextResponse.json({ ok: true })
}
