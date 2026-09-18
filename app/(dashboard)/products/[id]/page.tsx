import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import ProductDetail from './ProductDetail'
import { getPerms } from '@/lib/permissions'
import { orgPrisma } from '@/lib/orgPrisma'
import { stavProduktu } from '@/lib/sklad'

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const perms = getPerms(session!.user)
  const showSklad = perms.sklad !== 'ZADNY'

  const [product, allCategories, usageItems, usageCount, sklad] = await Promise.all([
    prisma.product.findFirst({
      where: { id: params.id, orgId },
      include: {
        categories: { orderBy: { nazev: 'asc' } },
        cenikPolozky: { include: { cenik: { select: { id: true, kod: true, nazev: true } } }, orderBy: { cenik: { nazev: 'asc' } } },
      },
    }),
    prisma.category.findMany({ where: { orgId }, orderBy: { poradi: 'asc' } }),
    prisma.quoteItem.findMany({
      where: { productId: params.id, deal: { orgId } },
      include: { deal: { select: { vytvoreno: true } } },
      orderBy: { deal: { vytvoreno: 'desc' } },
      take: 1,
    }),
    prisma.quoteItem.count({ where: { productId: params.id, deal: { orgId } } }),
    showSklad ? stavProduktu(orgPrisma(orgId), orgId, params.id) : Promise.resolve(null),
  ])
  if (!product) notFound()

  return (
    <div className="max-w-5xl">
      <ProductDetail
        sklad={sklad}
        showNakupky={perms.financeNakupky}
        canEditDodavatele={perms.sklad === 'PLNY'}
        product={{
          id: product.id,
          kod: product.kod,
          nazev: product.nazev,
          produktovaRada: product.produktovaRada,
          jednotka: product.jednotka,
          popis: product.popis,
          dphSazba: product.dphSazba,
          nakladovaCena: product.nakladovaCena !== null ? Number(product.nakladovaCena) : null,
          standardniCena: Number(product.standardniCena),
          objednaciKod: product.objednaciKod,
          dodaciLhuta: product.dodaciLhuta,
          minMnozstvi: product.minMnozstvi !== null ? Number(product.minMnozstvi) : null,
          aktivni: product.aktivni,
          vytvoreno: product.vytvoreno.toISOString(),
          categories: product.categories.map(c => ({ id: c.id, nazev: c.nazev, barva: c.barva })),
          cenikPolozky: product.cenikPolozky.map(p => ({
            id: p.id,
            cenikId: p.cenikId,
            cena: Number(p.cena),
            cenik: p.cenik,
          })),
        }}
        allCategories={allCategories.map(c => ({ id: c.id, nazev: c.nazev, barva: c.barva }))}
        usage={{
          totalCount: usageCount,
          lastUsed: usageItems.length > 0 ? usageItems[0].deal.vytvoreno.toISOString() : null,
        }}
      />
    </div>
  )
}
