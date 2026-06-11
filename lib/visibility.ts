import { prisma } from './prisma'

export async function getVisibleDealIds(orgId: string, userId: string): Promise<string[] | null> {
  // Returns null = all visible, array = specific deal IDs visible
  const userNode = await prisma.visibilityNodeUser.findFirst({
    where: { userId, node: { orgId } },
    include: { node: true },
  })

  if (!userNode) return null // No restriction - see all

  if (userNode.viditelnost === 'ALL') return null

  if (userNode.viditelnost === 'OWN') {
    const deals = await prisma.deal.findMany({
      where: { orgId, userId },
      select: { id: true },
    })
    return deals.map(d => d.id)
  }

  // SELECTED: can see own + deals of selected users in same node
  return null // simplified - return null for now
}
