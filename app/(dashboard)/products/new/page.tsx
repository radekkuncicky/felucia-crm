import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import NewProductForm from './NewProductForm'
import Link from 'next/link'

export default async function NewProductPage() {
  await getServerSession(authOptions)

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/products" className="text-gray-400 hover:text-gray-600 text-sm">← Produkty</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nový produkt</h1>
      </div>
      <p className="text-sm text-gray-500 dark:text-slate-400">Kategorie přiřadíte v detailu produktu po jeho vytvoření.</p>
      <NewProductForm />
    </div>
  )
}
