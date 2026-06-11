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
  if (predavak.stav !== 'ROZPRACOVAN' && predavak.stav !== 'ODMITNUTO') {
    return NextResponse.json({ error: 'Nelze přidat položku v tomto stavu' }, { status: 422 })
  }

  const { nazev, mnozstvi, jednotka } = await req.json()
  if (!nazev?.trim()) return NextResponse.json({ error: 'Chybí název' }, { status: 400 })

  const polozka = await prisma.predavakPolozka.create({
    data: {
      predavakId: params.id,
      nazev,
      planovanoMnozstvi: mnozstvi ?? 1,
      mnozstviPouzito: mnozstvi ?? 1,
      jednotka: jednotka ?? 'ks',
      zahrnuto: true,
    },
  })

  return NextResponse.json(polozka, { status: 201 })
}
