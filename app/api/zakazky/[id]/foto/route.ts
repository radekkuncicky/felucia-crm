import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { canTechnikAccessZakazka } from '@/lib/zakazkyHelpers'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const isTechnik = session.user.role === 'TECHNIK'

  if (isTechnik && !(await canTechnikAccessZakazka(session.user.id, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const zakazka = await prisma.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { url, popis } = await req.json()
  if (!url) return NextResponse.json({ error: 'Chybí URL' }, { status: 400 })

  const foto = await prisma.zakazkaFoto.create({
    data: { zakazkaId: params.id, url, popis: popis ?? null, nahralId: session.user.id },
  })

  return NextResponse.json(foto, { status: 201 })
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId

  const zakazka = await prisma.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const fotky = await prisma.zakazkaFoto.findMany({
    where: { zakazkaId: params.id },
    include: { nahral: { select: { id: true, jmeno: true } } },
    orderBy: { vytvoreno: 'desc' },
  })

  return NextResponse.json(fotky)
}
