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
