import { prisma } from '@/lib/prisma'

export async function generateSodCislo(orgId: string): Promise<string> {
  const year = new Date().getFullYear().toString().slice(2)
  const count = await prisma.sod.count({ where: { orgId } })
  return `SOD-${year}-${String(count + 1).padStart(3, '0')}`
}

export function predmetDilaByTechnologie(technologie: string): string {
  const map: Record<string, string> = {
    KLIMA: 'Realizace klimatizace',
    TEPELNE_CERPADLO: 'Realizace tepelného čerpadla',
    REKUPERACE: 'Realizace rekuperace vzduchu',
    VZDUCHOTECHNIKA: 'Realizace vzduchotechniky',
    PODLAHOVE_TOPENI: 'Realizace podlahového vytápění',
    JINE: 'Realizace díla',
  }
  return map[technologie] ?? 'Realizace díla'
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
