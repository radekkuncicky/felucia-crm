import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'
import { stavProduktu, zkontrolujMinimum } from '@/lib/sklad'

/** Ruční oprava zůstatku (inventura) — kladné i záporné množství, důvod povinný. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (getPerms(session.user).sklad !== 'PLNY') return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const { productId, mnozstvi, duvod } = await req.json()

  const qty = Number(mnozstvi)
  if (!productId || !Number.isFinite(qty) || qty === 0) {
    return NextResponse.json({ error: 'Chybí produkt nebo nenulové množství' }, { status: 400 })
  }
  if (!duvod?.trim()) {
    return NextResponse.json({ error: 'Důvod korekce je povinný' }, { status: 400 })
  }

  const product = await db.product.findFirst({
    where: { id: productId, orgId },
    select: { id: true, nazev: true, nakladovaCena: true },
  })
  if (!product) return NextResponse.json({ error: 'Produkt nenalezen' }, { status: 404 })

  const pohyb = await db.skladPohyb.create({
    data: {
      orgId,
      typ: 'KOREKCE',
      productId: product.id,
      nazev: product.nazev,
      mnozstvi: qty,
      nakupniCena: product.nakladovaCena,
      duvod: duvod.trim(),
      vytvorilId: session.user.id,
    },
  })

  const stav = await stavProduktu(db, orgId, product.id)
  if (qty < 0) await zkontrolujMinimum(orgId, product.id)
  return NextResponse.json({ ...pohyb, stav }, { status: 201 })
}
