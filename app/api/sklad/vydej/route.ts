import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { SkladKategorie } from '@prisma/client'
import { getPerms, forbidden } from '@/lib/permissions'
import { stavProduktu, zkontrolujMinimum } from '@/lib/sklad'

/**
 * Výdej ze skladu bez zakázky — provozní spotřeba nebo jiný důvod (povinný).
 * Výdej na zakázku vzniká jinde (schválení předávacího protokolu). Výdeje
 * mimo provozní spotřebu počítá KPI 5 „Materiál bez zakázky“ (docs/kpi-vedeni).
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (getPerms(session.user).sklad !== 'PLNY') return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const { productId, mnozstvi, kategorie, duvod } = await req.json()

  const qty = Number(mnozstvi)
  if (!productId || !Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: 'Chybí produkt nebo množství' }, { status: 400 })
  }
  if (!Object.values(SkladKategorie).includes(kategorie)) {
    return NextResponse.json({ error: 'Vyberte kategorii výdeje' }, { status: 400 })
  }
  if (!duvod?.trim()) {
    return NextResponse.json({ error: 'Důvod výdeje je povinný' }, { status: 400 })
  }

  const product = await db.product.findFirst({
    where: { id: productId, orgId },
    select: { id: true, nazev: true, nakladovaCena: true },
  })
  if (!product) return NextResponse.json({ error: 'Produkt nenalezen' }, { status: 404 })

  const pred = await stavProduktu(db, orgId, product.id)
  if (qty > pred.dostupne) {
    return NextResponse.json({ error: `Dostupné je jen ${pred.dostupne} (zbytek je rezervovaný nebo chybí)` }, { status: 400 })
  }

  const pohyb = await db.skladPohyb.create({
    data: {
      orgId,
      typ: 'VYDEJ',
      productId: product.id,
      nazev: product.nazev,
      mnozstvi: qty,
      nakupniCena: product.nakladovaCena,
      kategorie,
      duvod: duvod.trim(),
      vytvorilId: session.user.id,
    },
    include: { vytvoril: { select: { jmeno: true } } },
  })

  const stav = await stavProduktu(db, orgId, product.id)
  await zkontrolujMinimum(orgId, product.id)
  return NextResponse.json({ ...pohyb, stav }, { status: 201 })
}
