import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ImportWizard from './ImportWizard'

export default async function ImportProductsPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/dashboard')

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import produktů</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Importujte produkty z Excel souboru (XLSX)</p>
      </div>
      <ImportWizard />
    </div>
  )
}
