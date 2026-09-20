import fs from 'fs'
import path from 'path'

// Přesměruj Prisma na testovací DB DŘÍV, než se kdekoli importuje lib/prisma.
// Bere credentials z .env a jen mění název databáze na nanto_crm_test.
const envFile = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8')
const match = envFile.match(/^DATABASE_URL="?([^"\n]+)"?/m)
if (!match) throw new Error('tests/setup: DATABASE_URL nenalezena v .env')

const testUrl = match[1].replace(/nanto_crm(\?|$)/, 'nanto_crm_test$1')
if (!/nanto_crm_test/.test(testUrl)) {
  throw new Error('tests/setup: nepodařilo se odvodit testovací DB URL')
}
process.env.DATABASE_URL = testUrl

// NEXTAUTH_SECRET pro podepisování (mobilní JWT, podepsané odkazy na /uploads)
if (!process.env.NEXTAUTH_SECRET) {
  const m = envFile.match(/^NEXTAUTH_SECRET="?([^"\n]+)"?/m)
  if (m) process.env.NEXTAUTH_SECRET = m[1]
}

// RLS credentials z .env — orgPrisma pak i v testech jede pod rolí nanto_app
// (proti test DB; URL se odvozuje z DATABASE_URL). Viz lib/prisma.ts.
for (const key of ['RLS_DB_USER', 'RLS_DB_PASSWORD'] as const) {
  const m = envFile.match(new RegExp(`^${key}="?([^"\\n]+)"?`, 'm'))
  if (m) process.env[key] = m[1]
}

// RLS policies + webhook triggery na test DB (idempotentní; db push je nevytváří)
import { execFileSync } from 'child_process'
for (const file of ['../prisma/rls.sql', '../prisma/webhook-triggers.sql']) {
  execFileSync('psql', [testUrl, '-q', '-f', path.resolve(__dirname, file)], {
    stdio: ['ignore', 'ignore', 'ignore'],
  })
}
