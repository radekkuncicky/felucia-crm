import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const predavak = await prisma.predavak.findFirst({ where: { id: params.id, orgId } })
  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.user.role === 'TECHNIK' && predavak.technikId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { url, popis } = await req.json()
  if (!url) return NextResponse.json({ error: 'Chybí URL' }, { status: 400 })

  // Check max 20 photos
  const count = await prisma.predavakFoto.count({ where: { predavakId: params.id } })
  if (count >= 20) return NextResponse.json({ error: 'Maximálně 20 fotek na protokol' }, { status: 422 })

  // Check base64 size (~5MB = ~6.8MB base64)
  if (url.length > 7_200_000) {
    return NextResponse.json({ error: 'Fotka je příliš velká (max 5 MB)' }, { status: 422 })
  }

  const foto = await prisma.predavakFoto.create({
    data: { predavakId: params.id, url, popis: popis ?? null },
  })

  return NextResponse.json(foto, { status: 201 })
}
