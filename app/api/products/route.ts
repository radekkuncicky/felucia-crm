import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { getPlanLimits } from '@/lib/planLimits'
import { NextResponse } from 'next/server'
import { getPerms } from '@/lib/permissions'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const categoryId = searchParams.get('categoryId') || ''
  const productLine = searchParams.get('productLine') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(9999, Math.max(1, parseInt(searchParams.get('limit') || '9999')))

  const hasPagination = searchParams.has('page') || searchParams.has('limit')

  const where: Record<string, unknown> = { orgId }
  if (search) {
    where.OR = [
      { nazev: { contains: search, mode: 'insensitive' } },
      { kod: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (categoryId) where.categories = { some: { id: categoryId } }
  if (productLine) where.produktovaRada = productLine

  const include = { categories: { orderBy: { nazev: 'asc' } } } as const
  // Nákladové ceny jen s oprávněním financeNakupky
  const showNakupky = getPerms(session.user).financeNakupky
  const hideNakupky = <T extends { nakladovaCena: unknown }>(items: T[]) =>
    showNakupky ? items : items.map(p => ({ ...p, nakladovaCena: null }))

  if (!hasPagination && !search && !categoryId && !productLine) {
    const products = await db.product.findMany({
      where: { orgId },
      include,
      orderBy: { nazev: 'asc' },
    })
    return NextResponse.json(hideNakupky(products))
  }

  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      include,
      orderBy: { nazev: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return NextResponse.json({ products: hideNakupky(products), total, pages: Math.ceil(total / limit) })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const body = await req.json()
  const { nazev, kod, produktovaRada, popis, dphSazba, nakladovaCena, standardniCena, jednotka, categoryIds } = body

  if (!nazev || standardniCena === undefined) {
    return NextResponse.json({ error: 'Název a standardní cena jsou povinné' }, { status: 400 })
  }

  // SECURITY FIX: Validate numeric inputs — reject NaN to prevent database corruption
  const parsedCena = Number(standardniCena)
  if (isNaN(parsedCena) || parsedCena < 0) {
    return NextResponse.json({ error: 'Standardní cena musí být kladné číslo' }, { status: 400 })
  }
  if (dphSazba !== undefined && isNaN(Number(dphSazba))) {
    return NextResponse.json({ error: 'DPH sazba musí být číslo' }, { status: 400 })
  }
  if (nakladovaCena !== undefined && nakladovaCena !== '' && isNaN(Number(nakladovaCena))) {
    return NextResponse.json({ error: 'Nákladová cena musí být číslo' }, { status: 400 })
  }

  const limits = getPlanLimits(session.user.plan)
  if (limits.maxProducts !== Infinity) {
    const productCount = await db.product.count({ where: { orgId } })
    if (productCount >= limits.maxProducts) {
      return NextResponse.json({ error: `Dosáhli jste limitu ${limits.maxProducts} produktů pro váš plán.`, code: 'PLAN_LIMIT_REACHED' }, { status: 403 })
    }
  }

  if (kod) {
    const exists = await db.product.findFirst({ where: { orgId, kod } })
    if (exists) return NextResponse.json({ error: 'Produkt s tímto kódem již existuje' }, { status: 400 })
  }

  const product = await db.product.create({
    data: {
      orgId,
      kod: kod || null,
      nazev,
      produktovaRada: produktovaRada || null,
      popis: popis || null,
      dphSazba: dphSazba ? Number(dphSazba) : 12,
      nakladovaCena: nakladovaCena !== undefined && nakladovaCena !== '' && getPerms(session.user).financeNakupkyEdit ? Number(nakladovaCena) : null,
      standardniCena: parsedCena,
      jednotka: jednotka || 'ks',
      aktivni: true,
      ...(Array.isArray(categoryIds) && categoryIds.length > 0
        ? { categories: { connect: categoryIds.map((id: string) => ({ id })) } }
        : {}),
    },
    include: { categories: { orderBy: { nazev: 'asc' } } },
  })

  return NextResponse.json(product, { status: 201 })
}
