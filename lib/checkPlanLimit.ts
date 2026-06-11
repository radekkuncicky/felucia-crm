import { prisma } from './prisma'
import { getPlanLimits } from './planLimits'

export async function checkDealLimit(orgId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (!org) return false
  const limits = getPlanLimits(org.plan)
  if (limits.maxDeals === Infinity) return true
  const count = await prisma.deal.count({ where: { orgId } })
  return count < limits.maxDeals
}

export async function checkUserLimit(orgId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (!org) return false
  const limits = getPlanLimits(org.plan)
  if (limits.maxUsers === Infinity) return true
  const count = await prisma.user.count({ where: { orgId } })
  return count < limits.maxUsers
}
