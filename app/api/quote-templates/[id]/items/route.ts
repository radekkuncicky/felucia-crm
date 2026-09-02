import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

interface ItemBody {
  nazev: string
  mnozstvi?: number
  cenaZaKus?: number
  jednotka?: string
  sleva?: number
  productId?: string
  poznamky?: string
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(getPerms(session.user).obchod)) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const template = await db.quoteTemplate.findFirst({ where: { id: params.id, orgId } })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  // Support both { items: [...] } and single item
  const itemsRaw: ItemBody[] = body.items && Array.isArray(body.items) ? body.items : [body]

  if (itemsRaw.length === 0) {
    return NextResponse.json({ error: 'Žádné položky' }, { status: 400 })
  }

  const existingPolozky = Array.isArray(template.polozky) ? (template.polozky as object[]) : []

  const newItems = itemsRaw.map(item => ({
    product_id: item.productId || null,
    nazev: item.nazev ?? '',
    mnozstvi: Number(item.mnozstvi) || 1,
    cena_za_kus: Number(item.cenaZaKus) || 0,
    jednotka: item.jednotka || 'ks',
    sleva: Number(item.sleva) || 0,
    poznamky: item.poznamky || null,
  }))

  const updatedPolozky = [...existingPolozky, ...newItems]

  const updated = await db.quoteTemplate.update({
    where: { id: params.id },
    data: { polozky: updatedPolozky },
  })

  return NextResponse.json({ polozky: updated.polozky }, { status: 201 })
}
