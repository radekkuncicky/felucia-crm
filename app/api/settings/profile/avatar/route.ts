import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('avatar') as File | null
  if (!file) return NextResponse.json({ error: 'Žádný soubor' }, { status: 400 })

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Soubor je příliš velký (max 5 MB)' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Povoleny jsou pouze obrázky' }, { status: 400 })
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const filename = `${session.user.id}.${ext}`
  const dest = path.join(process.cwd(), 'public', 'uploads', 'avatars', filename)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(dest, buffer)

  const avatarPath = `/uploads/avatars/${filename}`
  await orgPrisma(session.user.orgId).user.update({ where: { id: session.user.id }, data: { avatar: avatarPath } })

  return NextResponse.json({ avatar: avatarPath })
}
