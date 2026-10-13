import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'
import { stavProduktu } from '@/lib/sklad'
import { maskNakupky } from '@/lib/maskNakupky'

/** Příjem na sklad — jen katalogový produkt (sklad v2 vede zásobu na products.id). */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (perms.sklad !== 'PLNY') return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const { productId, mnozstvi, nakupniCena, poznamka } = await req.json()

  const qty = Number(mnozstvi)
  if (!productId || !Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: 'Chybí produkt nebo množství' }, { status: 400 })
  }

  const product = await db.product.findFirst({
    where: { id: productId, orgId },
    select: { id: true, nazev: true, jednotka: true, nakladovaCena: true },
  })
  if (!product) return NextResponse.json({ error: 'Produkt nenalezen' }, { status: 404 })

  // Vlastní nákupní cenu příjmu jen s financeNakupkyEdit, jinak cena z katalogu
  const cena = perms.financeNakupkyEdit && nakupniCena !== undefined && nakupniCena !== null && nakupniCena !== ''
    ? Number(nakupniCena)
    : product.nakladovaCena !== null ? Number(product.nakladovaCena) : null

  const pohyb = await db.skladPohyb.create({
    data: {
      orgId,
      typ: 'PRIJEM_SKLAD',
      productId: product.id,
      nazev: product.nazev,
      mnozstvi: qty,
      nakupniCena: cena,
      duvod: poznamka?.trim() || null,
      vytvorilId: session.user.id,
    },
    include: {
      vytvoril: { select: { jmeno: true } },
    },
  })

  const stav = await stavProduktu(db, orgId, product.id)
  return NextResponse.json(maskNakupky({ ...pohyb, stav }, perms), { status: 201 })
}
