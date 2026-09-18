import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPerms } from '@/lib/permissions'
import { orgPrisma } from '@/lib/orgPrisma'
import { stavSkladu } from '@/lib/sklad'
import ProductsClient from './ProductsClient'

export default async function ProductsPage() {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const perms = getPerms(session!.user)
  // Správa ceníků = nastavení organizace (stejně jako API /api/ceniky)
  const isAdmin = perms.nastaveniOrg
  const showNakladoveCeny = perms.financeNakupky
  const showSklad = perms.sklad !== 'ZADNY'

  const [products, categories, ceniky, stav] = await Promise.all([
    prisma.product.findMany({
      where: { orgId },
      include: {
        categories: { orderBy: { nazev: 'asc' } },
        dodavatele: { where: { hlavni: true }, select: { dodavatel: { select: { nazev: true } } }, take: 1 },
      },
      orderBy: { nazev: 'asc' },
    }),
    prisma.category.findMany({ where: { orgId }, orderBy: { poradi: 'asc' } }),
    prisma.cenik.findMany({
      where: { orgId },
      include: { _count: { select: { polozky: true } }, polozky: { select: { id: true } } },
      orderBy: { nazev: 'asc' },
    }),
    showSklad ? stavSkladu(orgPrisma(orgId), orgId) : Promise.resolve(new Map()),
  ])

  return (
    <ProductsClient
      isAdmin={isAdmin}
      showNakladoveCeny={showNakladoveCeny}
      showSklad={showSklad}
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
        dodavatel: p.dodavatele[0]?.dodavatel.nazev ?? null,
        naSklade: stav.get(p.id)?.naSklade ?? 0,
        dostupne: stav.get(p.id)?.dostupne ?? 0,
        minMnozstvi: p.minMnozstvi !== null ? Number(p.minMnozstvi) : null,
      }))}
      categories={categories.map(c => ({ id: c.id, nazev: c.nazev, barva: c.barva }))}
      ceniky={ceniky.map(c => ({ id: c.id, kod: c.kod, nazev: c.nazev, popis: c.popis, aktivni: c.aktivni, _count: c._count, vytvoreno: c.vytvoreno.toISOString() }))}
    />
  )
}
