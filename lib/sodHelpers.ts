import { prisma } from '@/lib/prisma'

export async function generateSodCislo(orgId: string): Promise<string> {
  const year = new Date().getFullYear().toString().slice(2)
  const count = await prisma.sod.count({ where: { orgId } })
  return `SOD-${year}-${String(count + 1).padStart(3, '0')}`
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
