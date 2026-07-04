// Generátor prisma/rls.sql — Row Level Security pro tenant tabulky.
// Spuštění: npx tsx scripts/generate-rls-sql.ts
// Zdroj pravdy: prisma/schema.prisma (modely s polem orgId).
// Sync s TENANT_MODELS hlídá tests/rls.test.ts.
import fs from 'fs'
import path from 'path'

const schema = fs.readFileSync(path.resolve(__dirname, '../prisma/schema.prisma'), 'utf8')

type Model = { name: string; table: string }
const models: Model[] = []

// rozšířená třída znaků kvůli modelům s diakritikou (ZakázkaDokument)
const modelRe = /^model\s+([A-Za-z0-9_À-ſ]+)\s+\{([\s\S]*?)^\}/gm
let m: RegExpExecArray | null
while ((m = modelRe.exec(schema))) {
  const [, name, body] = m
  if (!/^\s*orgId\s+String/m.test(body)) continue
  const mapMatch = body.match(/@@map\("([^"]+)"\)/)
  models.push({ name, table: mapMatch ? mapMatch[1] : name })
}

if (models.length < 10) throw new Error(`generate-rls-sql: nalezeno jen ${models.length} modelů — parser asi selhal`)

const COND = `"orgId" = current_setting('app.org_id', true)`

const lines: string[] = [
  '-- GENEROVÁNO scripts/generate-rls-sql.ts — NEEDITOVAT RUČNĚ.',
  '-- Idempotentní. Aplikace: psql <DB_URL> -f prisma/rls.sql (jako owner nanto či superuser).',
  '-- Role nanto_app musí existovat (jednorázově: CREATE ROLE nanto_app LOGIN PASSWORD \'…\' NOBYPASSRLS).',
  '--',
  '-- Princip: orgPrisma se připojuje jako nanto_app a před dotazy nastavuje',
  '-- app.org_id (set_config, transaction-local). Policy bez kontextu nic',
  '-- nevrátí (fail-closed). Bare prisma (auth/superadmin/worker/migrace) se',
  '-- připojuje jako owner nanto, kterého RLS neomezuje (bez FORCE).',
  '',
  'GRANT USAGE ON SCHEMA public TO nanto_app;',
  'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nanto_app;',
  'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nanto_app;',
  'ALTER DEFAULT PRIVILEGES FOR ROLE nanto IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nanto_app;',
  'ALTER DEFAULT PRIVILEGES FOR ROLE nanto IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO nanto_app;',
  '',
]

for (const { name, table } of models.sort((a, b) => a.table.localeCompare(b.table))) {
  lines.push(
    `-- ${name}`,
    `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`,
    `DROP POLICY IF EXISTS org_rls ON "${table}";`,
    `CREATE POLICY org_rls ON "${table}" FOR ALL TO nanto_app`,
    `  USING (${COND}) WITH CHECK (${COND});`,
    '',
  )
}

const out = path.resolve(__dirname, '../prisma/rls.sql')
fs.writeFileSync(out, lines.join('\n'))
console.log(`prisma/rls.sql: ${models.length} tabulek`)
console.log(models.map((x) => x.table).join(', '))
