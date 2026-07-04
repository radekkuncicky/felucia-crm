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

export async function checkQuoteTemplateLimit(orgId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (!org) return false
  const limits = getPlanLimits(org.plan)
  if (limits.maxQuoteTemplates === Infinity) return true
  // Stejná množina jako počítá /api/settings/quote-templates — vlastní šablony všech typů
  const count = await prisma.quoteTemplate.count({
    where: { orgId, isSystem: false, typ: { in: ['BASE', 'STANDARD', 'CUSTOM_HTML'] } },
  })
  return count < limits.maxQuoteTemplates
}
