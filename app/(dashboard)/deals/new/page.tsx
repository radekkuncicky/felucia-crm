import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import NewDealForm from './NewDealForm'

export default async function NewDealPage({ searchParams }: { searchParams: { clientId?: string } }) {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId

  const clients = await prisma.client.findMany({
    where: { orgId },
    orderBy: [{ prijmeni: 'asc' }, { jmeno: 'asc' }],
  })

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Nový obchodní případ</h1>
      <NewDealForm clients={clients.map(c => ({ id: c.id, jmeno: c.jmeno, prijmeni: c.prijmeni }))} defaultClientId={searchParams.clientId ?? ''} />
    </div>
  )
}
