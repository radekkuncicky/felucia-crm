import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden, canEditKatalog } from '@/lib/permissions'
import { priraditDodavateleProduktum } from '@/lib/productDodavatele'

const MAX_PRODUKTU = 1000

/** Hromadné přiřazení dodavatele: { productIds: string[], dodavatelId, hlavni?: boolean } */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEditKatalog(getPerms(session.user))) return forbidden()

  const body = await req.json().catch(() => ({}))
  const productIds = Array.isArray(body.productIds) ? body.productIds.filter((x: unknown): x is string => typeof x === 'string') : []
  const dodavatelId = typeof body.dodavatelId === 'string' ? body.dodavatelId : ''
  if (!dodavatelId) return NextResponse.json({ error: 'Vyberte dodavatele' }, { status: 400 })
  if (productIds.length === 0) return NextResponse.json({ error: 'Nevybrali jste žádný produkt' }, { status: 400 })
  if (productIds.length > MAX_PRODUKTU) return NextResponse.json({ error: `Najednou max. ${MAX_PRODUKTU} produktů` }, { status: 400 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const [dodavatel, pocetProduktu] = await Promise.all([
    db.dodavatel.findFirst({ where: { id: dodavatelId, orgId }, select: { id: true } }),
    db.product.count({ where: { id: { in: productIds }, orgId } }),
  ])
  if (!dodavatel) return NextResponse.json({ error: 'Dodavatel nenalezen' }, { status: 404 })
  // Cizí/neexistující ID → nic nezapsat
  if (pocetProduktu !== new Set(productIds).size) return NextResponse.json({ error: 'Některé produkty nenalezeny' }, { status: 404 })

  const vysledek = await priraditDodavateleProduktum(db, orgId, productIds, dodavatelId, { hlavni: body.hlavni === true })
  return NextResponse.json(vysledek)
}
