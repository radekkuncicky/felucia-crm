import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import CategoriesClient from './CategoriesClient'

export default async function CategoriesPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/dashboard')
  const orgId = session.user.orgId

  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      where: { orgId },
      include: {
        products: {
          orderBy: { nazev: 'asc' },
          select: { id: true, nazev: true, kod: true, aktivni: true },
        },
      },
      orderBy: { poradi: 'asc' },
    }),
    prisma.product.findMany({
      where: { orgId },
      orderBy: { nazev: 'asc' },
      select: { id: true, nazev: true, kod: true, aktivni: true, categories: { select: { id: true } } },
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kategorie produktů</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Spravujte kategorie a přiřazujte do nich produkty</p>
      </div>
      <CategoriesClient
        initCategories={categories.map(c => ({
          id: c.id,
          nazev: c.nazev,
          barva: c.barva,
          poradi: c.poradi,
          products: c.products.map(p => ({ id: p.id, nazev: p.nazev, kod: p.kod, aktivni: p.aktivni })),
        }))}
        allProducts={products.map(p => ({
          id: p.id,
          nazev: p.nazev,
          kod: p.kod,
          categoryIds: p.categories.map(c => c.id),
          aktivni: p.aktivni,
        }))}
      />
    </div>
  )
}
