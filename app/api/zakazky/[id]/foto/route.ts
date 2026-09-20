import { getServerSession } from 'next-auth'
import { isImageDataUri } from '@/lib/uploadSafety'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'
import { getPerms } from '@/lib/permissions'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  if (!(await canAccessZakazka(session.user, getPerms(session.user), params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const zakazka = await db.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { url, popis } = await req.json()
  if (!url) return NextResponse.json({ error: 'Chybí URL' }, { status: 400 })
  // Přijímáme jen obrázek jako data: URI — url se ukládá do DB a jinde se z ní
  // skládá cesta na disk, libovolný string by umožnil path traversal.
  if (!isImageDataUri(url)) return NextResponse.json({ error: 'Neplatný formát obrázku' }, { status: 400 })

  const foto = await db.zakazkaFoto.create({
    data: { zakazkaId: params.id, url, popis: popis ?? null, nahralId: session.user.id },
  })

  return NextResponse.json(foto, { status: 201 })
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const zakazka = await db.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const fotky = await db.zakazkaFoto.findMany({
    where: { zakazkaId: params.id },
    include: { nahral: { select: { id: true, jmeno: true } } },
    orderBy: { vytvoreno: 'desc' },
  })

  return NextResponse.json(fotky)
}
