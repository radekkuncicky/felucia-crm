import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms } from '@/lib/permissions'

interface CenikCol { kod: string; nazev: string }

interface ProductImport {
  kod: string
  nazev: string
  produktovaRada: string
  kategorie: string
  jednotka: string
  popis: string
  dphSazba: number
  nakladovaCena: number | null
  standardniCena: number
  objednaciKod?: string
  dodavatel?: string
  dodaciLhuta?: string
  // ceník prices: cenikKod → cena
  cenikyCeny: Record<string, number>
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).nastaveniOrg) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const body = await req.json() as { products: ProductImport[]; ceniky: CenikCol[] }
  if (!Array.isArray(body.products)) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

  const { products, ceniky = [] } = body

  let importedProducts = 0
  let importedCeniky = 0
  let importedPolozky = 0
  const errors: string[] = []

  // 1. Ensure categories exist
  const categoryCache = new Map<string, string>()

  async function getOrCreateCategory(nazev: string): Promise<string | null> {
    if (!nazev) return null
    if (categoryCache.has(nazev)) return categoryCache.get(nazev)!
    let cat = await db.category.findFirst({ where: { orgId, nazev } })
    if (!cat) {
      const count = await db.category.count({ where: { orgId } })
      cat = await db.category.create({ data: { orgId, nazev, barva: '#6B7280', poradi: count } })
    }
    categoryCache.set(nazev, cat.id)
    return cat.id
  }

  // Dodavatel z importu = entita Dodavatel (find-or-create podle názvu) + hlavní vazba na produkt
  const dodavatelCache = new Map<string, string>()

  async function getOrCreateDodavatel(nazev: string): Promise<string | null> {
    const n = nazev?.trim()
    if (!n) return null
    if (dodavatelCache.has(n)) return dodavatelCache.get(n)!
    let d = await db.dodavatel.findFirst({ where: { orgId, nazev: n } })
    if (!d) d = await db.dodavatel.create({ data: { orgId, nazev: n } })
    dodavatelCache.set(n, d.id)
    return d.id
  }

  // 2. Import products (find by orgId + kod, then create or update)
  const productCache = new Map<string, string>() // effectiveKod → product.id

  for (const p of products) {
    try {
      if (!p.nazev) { errors.push(`Řádek bez názvu přeskočen`); continue }

      const categoryId = await getOrCreateCategory(p.kategorie)
      // For Raynet imports: kod is empty, use objednaciKod as key; fallback to name
      const effectiveKod = p.kod || p.objednaciKod || `_${p.nazev.slice(0, 40)}`

      const baseData = {
        nazev: p.nazev,
        produktovaRada: p.produktovaRada || null,
        jednotka: p.jednotka || 'ks',
        popis: p.popis || null,
        dphSazba: p.dphSazba || 12,
        nakladovaCena: p.nakladovaCena ?? null,
        standardniCena: p.standardniCena || 0,
        objednaciKod: p.objednaciKod || null,
        dodaciLhuta: p.dodaciLhuta || null,
      }

      let product = await db.product.findFirst({ where: { orgId, kod: effectiveKod } })
      if (product) {
        product = await db.product.update({
          where: { id: product.id },
          data: {
            ...baseData,
            ...(categoryId ? { categories: { connect: { id: categoryId } } } : {}),
          },
        })
      } else {
        product = await db.product.create({
          data: {
            orgId,
            kod: effectiveKod,
            ...baseData,
            ...(categoryId ? { categories: { connect: { id: categoryId } } } : {}),
          },
        })
      }
      productCache.set(effectiveKod, product.id)
      importedProducts++

      const dodavatelId = await getOrCreateDodavatel(p.dodavatel ?? '')
      if (dodavatelId) {
        const maHlavniho = await db.productDodavatel.findFirst({ where: { orgId, productId: product.id, hlavni: true, NOT: { dodavatelId } } })
        await db.productDodavatel.upsert({
          where: { productId_dodavatelId: { productId: product.id, dodavatelId } },
          create: { orgId, productId: product.id, dodavatelId, objednaciKod: p.objednaciKod || null, nakupniCena: p.nakladovaCena ?? null, dodaciLhuta: p.dodaciLhuta || null, hlavni: !maHlavniho },
          update: { objednaciKod: p.objednaciKod || null, nakupniCena: p.nakladovaCena ?? null, dodaciLhuta: p.dodaciLhuta || null },
        })
      }
    } catch (e) {
      errors.push(`${p.nazev}: ${String(e)}`)
    }
  }

  // 3. Import ceníky
  if (ceniky.length > 0) {
    for (const c of ceniky) {
      try {
        let cenik = await db.cenik.findFirst({ where: { orgId, kod: c.kod } })
        if (!cenik) {
          cenik = await db.cenik.create({ data: { orgId, kod: c.kod, nazev: c.nazev } })
          importedCeniky++
        }

        // Add products to ceník
        for (const p of products) {
          if (!(c.kod in p.cenikyCeny)) continue
          const cena = p.cenikyCeny[c.kod]
          if (cena === undefined || cena === null) continue

          const productKod = p.kod || `_${p.nazev.slice(0, 40)}`
          const productId = productCache.get(productKod)
          if (!productId) continue

          await db.cenikPolozka.upsert({
            where: { cenikId_productId: { cenikId: cenik.id, productId } },
            update: { cena },
            create: { cenikId: cenik.id, productId, cena },
          })
          importedPolozky++
        }
      } catch (e) {
        errors.push(`Ceník ${c.kod}: ${String(e)}`)
      }
    }
  }

  return NextResponse.json({ importedProducts, importedCeniky, importedPolozky, errors })
}
