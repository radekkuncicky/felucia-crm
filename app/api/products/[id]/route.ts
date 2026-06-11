import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const product = await prisma.product.findFirst({
    where: { id: params.id, orgId },
    include: {
      categories: { orderBy: { nazev: 'asc' } },
      cenikPolozky: { include: { cenik: true } },
    },
  })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(product)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const product = await prisma.product.findFirst({ where: { id: params.id, orgId } })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  // Validate unique kod if changed
  if (body.kod && body.kod !== product.kod) {
    const exists = await prisma.product.findFirst({ where: { orgId, kod: body.kod, NOT: { id: params.id } } })
    if (exists) return NextResponse.json({ error: 'Kód již existuje' }, { status: 400 })
  }

  const data: Record<string, unknown> = {
    kod: body.kod !== undefined ? (body.kod || null) : product.kod,
    nazev: body.nazev ?? product.nazev,
    produktovaRada: body.produktovaRada !== undefined ? (body.produktovaRada || null) : product.produktovaRada,
    popis: body.popis !== undefined ? (body.popis || null) : product.popis,
    dphSazba: body.dphSazba !== undefined ? Number(body.dphSazba) : product.dphSazba,
    nakladovaCena: body.nakladovaCena !== undefined ? (body.nakladovaCena !== null && body.nakladovaCena !== '' ? Number(body.nakladovaCena) : null) : product.nakladovaCena,
    standardniCena: body.standardniCena !== undefined ? Number(body.standardniCena) : product.standardniCena,
    jednotka: body.jednotka ?? product.jednotka,
    aktivni: body.aktivni !== undefined ? body.aktivni : product.aktivni,
    objednaciKod: body.objednaciKod !== undefined ? (body.objednaciKod || null) : product.objednaciKod,
    dodavatel: body.dodavatel !== undefined ? (body.dodavatel || null) : product.dodavatel,
    dodaciLhuta: body.dodaciLhuta !== undefined ? (body.dodaciLhuta || null) : product.dodaciLhuta,
  }

  // Handle M2M category assignment
  if (Array.isArray(body.categoryIds)) {
    data.categories = { set: body.categoryIds.map((id: string) => ({ id })) }
  }

  const updated = await prisma.product.update({
    where: { id: params.id },
    data,
    include: { categories: { orderBy: { nazev: 'asc' } } },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId

  const product = await prisma.product.findFirst({ where: { id: params.id, orgId } })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.product.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
