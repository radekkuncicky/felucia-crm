import { orgPrisma } from '@/lib/orgPrisma'

/**
 * Další volné číslo OP v řadě OP-RR-NNN pro danou organizaci.
 * Samo o sobě není race-safe — vždy volat přes createWithUniqueKod
 * (unique constraint deals(orgId, kod) kolizi zachytí a číslo se přegeneruje).
 */
export async function generateDealKod(orgId: string): Promise<string> {
  const yr = new Date().getFullYear() % 100
  const prefix = `OP-${yr.toString().padStart(2, '0')}-`
  const last = await orgPrisma(orgId).deal.findFirst({
    where: { orgId, kod: { startsWith: prefix } },
    orderBy: { kod: 'desc' },
    select: { kod: true },
  })
  const lastNum = last?.kod ? parseInt(last.kod.replace(prefix, ''), 10) : 0
  return `${prefix}${String(lastNum + 1).padStart(3, '0')}`
}
