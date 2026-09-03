import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { orgPrisma } from '@/lib/orgPrisma'
import { generateQuoteKod } from '@/lib/quoteKod'
import { createWithUniqueKod } from '@/lib/uniqueKod'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(getPerms(session.user).obchod)) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  if (!q) return NextResponse.json({ error: 'Missing q parameter' }, { status: 400 })

  const quote = await db.quote.findFirst({
    where: {
      OR: [{ id: q }, { kod: q }],
      deal: { orgId },
    },
    select: { id: true, dealId: true, kod: true, nazev: true },
  })
  if (!quote) return NextResponse.json({ error: `Nabídka ${q} nenalezena` }, { status: 404 })
  return NextResponse.json(quote)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(getPerms(session.user).obchod)) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const body = await req.json()
  let { dealId } = body
  const { nazev, items = [], dphSazba = 12 } = body

  if (!dealId) return NextResponse.json({ error: 'dealId is required' }, { status: 400 })

  // Pokud dealId vypadá jako OP kód (např. "OP-26-071"), vyhledej skutečné ID
  if (typeof dealId === 'string' && dealId.includes('OP-')) {
    const dealByKod = await db.deal.findFirst({ where: { kod: dealId, orgId } })
    if (!dealByKod) return NextResponse.json({ error: `Deal ${dealId} not found` }, { status: 404 })
    dealId = dealByKod.id
  }

  // Ověř že deal patří do org
  const deal = await db.deal.findFirst({ where: { id: dealId, orgId } })
  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  // Fetch products for items missing jednotka — use product's jednotka as fallback
  const missingUnitProductIds = Array.from(new Set<string>(
    items
      .filter((i: { productId?: string | null; jednotka?: string }) => i.productId && !i.jednotka)
      .map((i: { productId: string }) => i.productId)
  ))

  const productJednotkaMapa: Record<string, string> = {}
  if (missingUnitProductIds.length > 0) {
    const prods = await db.product.findMany({
      where: { id: { in: missingUnitProductIds } },
      select: { id: true, jednotka: true },
    })
    prods.forEach(p => { productJednotkaMapa[p.id] = p.jednotka })
  }

  // Kód nabídky per org s rokem (NAB-YY-NNNN) — při kolizi (souběh) se přegeneruje
  const quote = await createWithUniqueKod(() => generateQuoteKod(orgId), kod => db.quote.create({
    data: {
      dealId,
      orgId,
      nazev: nazev || 'Varianta A',
      kod,
      dphSazba,
      aktivni: false,
      items: {
        create: items.map((item: {
          nazev: string
          mnozstvi?: number
          cenaZaKus?: number
          jednotka?: string
          sleva?: number
          productId?: string | null
          poznamky?: string | null
          poradi?: number
        }, idx: number) => ({
          nazev: item.nazev,
          mnozstvi: Number(item.mnozstvi ?? 1),
          cenaZaKus: Number(item.cenaZaKus ?? 0),
          jednotka: item.jednotka || (item.productId ? productJednotkaMapa[item.productId] : undefined) || 'ks',
          sleva: Number(item.sleva ?? 0),
          productId: item.productId ?? null,
          poznamky: item.poznamky ?? null,
          poradi: item.poradi ?? idx,
        }))
      }
    },
    include: { items: true }
  }))

  return NextResponse.json(quote)
}
