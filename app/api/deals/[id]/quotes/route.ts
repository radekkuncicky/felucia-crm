import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { generateQuoteKod } from '@/lib/quoteKod'
import { logAction } from '@/lib/auditLog'
import { createNotification } from '@/lib/createNotification'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const deal = await db.deal.findFirst({ where: { id: params.id, orgId } })
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const quotes = await db.quote.findMany({
    where: { dealId: params.id },
    include: { items: { include: { product: true }, orderBy: { poradi: 'asc' } } },
    orderBy: { vytvoreno: 'asc' },
  })

  return NextResponse.json(quotes)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const deal = await db.deal.findFirst({ where: { id: params.id, orgId }, include: { client: { select: { jmeno: true } } } })
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { nazev, popis, dphSazba, items } = body

  // SECURITY FIX: Validate numeric inputs in quote items — reject NaN to prevent data corruption
  if (dphSazba !== undefined && isNaN(Number(dphSazba))) {
    return NextResponse.json({ error: 'DPH sazba musí být číslo' }, { status: 400 })
  }
  if (Array.isArray(items)) {
    for (const item of items) {
      if (isNaN(Number(item.mnozstvi)) || Number(item.mnozstvi) <= 0) {
        return NextResponse.json({ error: `Neplatné množství pro položku: ${item.nazev}` }, { status: 400 })
      }
      if (isNaN(Number(item.cenaZaKus)) || Number(item.cenaZaKus) < 0) {
        return NextResponse.json({ error: `Neplatná cena pro položku: ${item.nazev}` }, { status: 400 })
      }
    }
  }

  const count = await db.quote.count({ where: { dealId: params.id } })
  const quoteName = nazev || `Nabídka ${count + 1}`
  const kod = await generateQuoteKod(orgId)

  const quote = await db.quote.create({
    data: {
      orgId,
      dealId: params.id,
      kod,
      nazev: quoteName,
      popis: popis || null,
      dphSazba: dphSazba !== undefined ? Number(dphSazba) : deal.dphSazba,
      aktivni: false,
      ...(items && items.length > 0 ? {
        items: {
          create: items.map((item: { productId?: string; nazev: string; mnozstvi: number; cenaZaKus: number; jednotka?: string; sleva?: number; poznamky?: string; poradi?: number; kod?: string }) => ({
            dealId: params.id,
            productId: item.productId || null,
            kod: item.kod || null,
            nazev: item.nazev,
            mnozstvi: Number(item.mnozstvi),
            jednotka: item.jednotka || 'ks',
            cenaZaKus: Number(item.cenaZaKus),
            sleva: Number(item.sleva || 0),
            poznamky: item.poznamky || null,
            poradi: Number(item.poradi ?? 0),
          })),
        },
      } : {}),
    },
    include: { items: { include: { product: true } } },
  })

  if (deal.userId && deal.userId !== session.user.id) {
    await createNotification({
      orgId,
      userId: deal.userId,
      typ: 'NOVA_NABIDKA',
      zprava: `Nabídka ${quote.kod} vytvořena pro ${deal.client.jmeno}`,
      dealId: deal.id,
    })
  }

  await logAction({
    orgId,
    userId: session.user.id,
    typAkce: 'CREATE',
    typZaznamu: 'Quote',
    zaznamId: quote.id,
    zaznamNazev: `${quote.kod ?? ''} ${quote.nazev}`.trim(),
    zmeny: { dealId: params.id, nazev: quote.nazev, kod: quote.kod },
  })

  return NextResponse.json(quote, { status: 201 })
}
