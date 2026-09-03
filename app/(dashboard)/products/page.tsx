import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPerms } from '@/lib/permissions'
import ProductsClient from './ProductsClient'

export default async function ProductsPage() {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const perms = getPerms(session!.user)
  // Správa ceníků = nastavení organizace (stejně jako API /api/ceniky)
  const isAdmin = perms.nastaveniOrg
  const showNakladoveCeny = perms.financeNakupky

  const [products, categories, ceniky] = await Promise.all([
    prisma.product.findMany({
      where: { orgId },
      include: { categories: { orderBy: { nazev: 'asc' } } },
      orderBy: { nazev: 'asc' },
    }),
    prisma.category.findMany({ where: { orgId }, orderBy: { poradi: 'asc' } }),
    prisma.cenik.findMany({
      where: { orgId },
      include: { _count: { select: { polozky: true } }, polozky: { select: { id: true } } },
      orderBy: { nazev: 'asc' },
    }),
  ])

  return (
    <ProductsClient
      isAdmin={isAdmin}
      showNakladoveCeny={showNakladoveCeny}
      products={products.map(p => ({
        id: p.id,
        kod: p.kod,
        nazev: p.nazev,
        produktovaRada: p.produktovaRada,
        categories: p.categories.map(c => ({ id: c.id, nazev: c.nazev, barva: c.barva })),
        jednotka: p.jednotka,
        popis: p.popis,
        dphSazba: p.dphSazba,
        nakladovaCena: showNakladoveCeny && p.nakladovaCena !== null ? Number(p.nakladovaCena) : null,
        standardniCena: Number(p.standardniCena),
        aktivni: p.aktivni,
      }))}
      categories={categories.map(c => ({ id: c.id, nazev: c.nazev, barva: c.barva }))}
      ceniky={ceniky.map(c => ({ id: c.id, kod: c.kod, nazev: c.nazev, popis: c.popis, aktivni: c.aktivni, _count: c._count, vytvoreno: c.vytvoreno.toISOString() }))}
    />
  )
}
