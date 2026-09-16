import { prisma } from '@/lib/prisma'

/**
 * Další volné číslo smlouvy v řadě SOD-RR-NNN pro danou organizaci.
 * Vychází z posledního existujícího čísla (ne z count) — po smazání/stornu
 * smlouvy uprostřed řady by count+1 kolidoval s existujícím číslem výš.
 */
export async function generateSodCislo(orgId: string): Promise<string> {
  const year = new Date().getFullYear().toString().slice(2)
  const prefix = `SOD-${year}-`
  const last = await prisma.sod.findFirst({
    where: { orgId, cislo: { startsWith: prefix } },
    orderBy: { cislo: 'desc' },
    select: { cislo: true },
  })
  const lastNum = last?.cislo ? parseInt(last.cislo.slice(prefix.length), 10) : 0
  return `${prefix}${String((isNaN(lastNum) ? 0 : lastNum) + 1).padStart(3, '0')}`
}

export function predmetDilaByTechnologie(technologie: string): string {
  const map: Record<string, string> = {
    KLIMA: 'Dodávka a montáž klimatizace',
    TEPELNE_CERPADLO: 'Dodávka a montáž tepelného čerpadla',
    REKUPERACE: 'Dodávka a montáž rekuperace vzduchu',
    VZDUCHOTECHNIKA: 'Dodávka a montáž vzduchotechniky',
    PODLAHOVE_TOPENI: 'Dodávka a montáž podlahového vytápění',
    JINE: 'Dodávka a montáž díla',
  }
  return map[technologie] ?? 'Dodávka a montáž díla'
}

export function kategorieByTechnologie(technologie: string): string {
  const map: Record<string, string> = {
    KLIMA: 'klimatizace',
    TEPELNE_CERPADLO: 'tepelné čerpadlo',
    REKUPERACE: 'rekuperace vzduchu',
    VZDUCHOTECHNIKA: 'vzduchotechnika',
    PODLAHOVE_TOPENI: 'podlahové vytápění',
    JINE: 'dílo',
  }
  return map[technologie] ?? 'dílo'
}
