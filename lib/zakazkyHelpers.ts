import { prisma } from './prisma'
import { orgPrisma } from './orgPrisma'

export async function generatePredavakCislo(orgId: string): Promise<string> {
  const year = new Date().getFullYear().toString().slice(2)
  const prefix = `PP-${year}-`
  const last = await prisma.predavak.findFirst({
    where: { orgId, cislo: { startsWith: prefix } },
    orderBy: { cislo: 'desc' },
  })
  const lastNum = last ? parseInt(last.cislo.slice(prefix.length), 10) : 0
  return `${prefix}${String(lastNum + 1).padStart(3, '0')}`
}

export async function generateVyuctovaniCislo(orgId: string): Promise<string> {
  const year = new Date().getFullYear().toString().slice(2)
  const prefix = `VYU-${year}-`
  const last = await prisma.vyuctovani.findFirst({
    where: { orgId, cislo: { startsWith: prefix } },
    orderBy: { cislo: 'desc' },
  })
  const lastNum = last ? parseInt(last.cislo.slice(prefix.length), 10) : 0
  return `${prefix}${String(lastNum + 1).padStart(3, '0')}`
}

export async function canTechnikAccessZakazka(
  technikId: string,
  zakazkaId: string,
  orgId: string,
): Promise<boolean> {
  const db = orgPrisma(orgId)
  const rel = await db.technikZakazka.findFirst({
    where: { technikId, zakazkaId, zakazka: { orgId } },
  })
  return !!rel
}
