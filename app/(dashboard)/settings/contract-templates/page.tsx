import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import ContractTemplatesManager from './ContractTemplatesManager'

export default async function ContractTemplatesPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/deals')
  const orgId = session.user.orgId

  const templates = await prisma.contractTemplate.findMany({
    where: { orgId },
    orderBy: { nazev: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nastavení</h1>
      </div>
      <ContractTemplatesManager templates={templates.map(t => ({ id: t.id, nazev: t.nazev, obsah: t.obsah }))} />
    </div>
  )
}
