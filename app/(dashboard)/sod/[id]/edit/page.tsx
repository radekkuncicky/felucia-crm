import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import SodEditClient from './SodEditClient'

export default async function SodEditPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'TECHNIK') notFound()

  const orgId = session.user.orgId

  const sod = await prisma.sod.findFirst({
    where: { id: params.id, orgId },
    select: { id: true, cislo: true, textSmlouvy: true },
  })

  if (!sod) notFound()

  return (
    <SodEditClient
      sodId={sod.id}
      cislo={sod.cislo}
      initialText={sod.textSmlouvy ?? ''}
    />
  )
}
