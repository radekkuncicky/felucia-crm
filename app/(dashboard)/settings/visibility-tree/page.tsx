import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import VisibilityTreeManager from './VisibilityTreeManager'

export default async function VisibilityTreePage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/dashboard')

  const orgId = session.user.orgId

  const [rawNodes, orgUsers] = await Promise.all([
    prisma.visibilityNode.findMany({
      where: { orgId },
      include: {
        users: {
          include: {
            user: { select: { id: true, jmeno: true, email: true } },
          },
        },
      },
      orderBy: [{ poradi: 'asc' }, { nazev: 'asc' }],
    }),
    prisma.user.findMany({
      where: { orgId, aktivni: true },
      select: { id: true, jmeno: true, email: true },
      orderBy: { jmeno: 'asc' },
    }),
  ])

  const nodes = rawNodes.map(n => ({
    id: n.id,
    parentId: n.parentId,
    nazev: n.nazev,
    poradi: n.poradi,
    users: n.users.map(nu => ({
      userId: nu.userId,
      viditelnost: nu.viditelnost as 'ALL' | 'OWN' | 'SELECTED',
      user: nu.user,
    })),
  }))

  return (
    <VisibilityTreeManager
      initialNodes={nodes}
      orgUsers={orgUsers}
    />
  )
}
