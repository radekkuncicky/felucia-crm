import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaApp: PrismaClient | undefined
}

function createPrismaClient(url: string) {
  const adapter = new PrismaPg({ connectionString: url })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

// URL pro RLS roli: stejná DB jako DATABASE_URL, jen jiné credentials.
// Odvozením (ne samostatnou URL v env) je zaručeno, že testy s přepnutou
// DATABASE_URL nikdy nesáhnou přes orgPrisma do jiné databáze.
function rlsUrl(): string | null {
  const user = process.env.RLS_DB_USER
  const pass = process.env.RLS_DB_PASSWORD
  if (!user || !pass) return null
  const u = new URL(process.env.DATABASE_URL!)
  u.username = user
  u.password = pass
  return u.toString()
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient(process.env.DATABASE_URL!)

/** True = orgPrisma jede pod RLS rolí nanto_app (fail-closed tenant izolace v DB). */
export const rlsActive = rlsUrl() !== null

/**
 * Klient pro tenant dotazy (orgPrisma): připojený jako RLS role nanto_app.
 * Bez RLS_DB_USER/RLS_DB_PASSWORD v env padá zpět na běžný klient (owner,
 * RLS se neuplatní) — chování jako před zavedením RLS.
 */
export const prismaApp = globalForPrisma.prismaApp
  ?? (rlsActive ? createPrismaClient(rlsUrl()!) : prisma)

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaApp = prismaApp
}
