// Generátor prisma/rls.sql — Row Level Security pro tenant tabulky.
// Spuštění: npx tsx scripts/generate-rls-sql.ts
// Zdroj pravdy: prisma/schema.prisma (modely s polem orgId).
// Sync s TENANT_MODELS hlídá tests/rls.test.ts.
import fs from 'fs'
import path from 'path'

const schema = fs.readFileSync(path.resolve(__dirname, '../prisma/schema.prisma'), 'utf8')

type Model = { name: string; table: string }
type ChildModel = { name: string; table: string; fk: string; parent: Model }
const models: Model[] = []
const allModels = new Map<string, { table: string; body: string }>()

// rozšířená třída znaků kvůli modelům s diakritikou (ZakázkaDokument)
const modelRe = /^model\s+([A-Za-z0-9_À-ſ]+)\s+\{([\s\S]*?)^\}/gm
let m: RegExpExecArray | null
while ((m = modelRe.exec(schema))) {
  const [, name, body] = m
  const mapMatch = body.match(/@@map\("([^"]+)"\)/)
  const table = mapMatch ? mapMatch[1] : name
  allModels.set(name, { table, body })
  if (!/^\s*orgId\s+String/m.test(body)) continue
  models.push({ name, table })
}

if (models.length < 10) throw new Error(`generate-rls-sql: nalezeno jen ${models.length} modelů — parser asi selhal`)

// Dětské tabulky bez orgId (položky, fotky, komentáře…): tenant se odvodí přes
// první POVINNOU relaci na tenant model (`x  Parent @relation(fields: [xId], …)`).
// Bez policy by nanto_app viděl/zapisoval jejich řádky napříč org — orgPrisma je
// nefiltruje (nejsou v TENANT_MODELS), spoléhá se jen na relační where v routes.
const tenantByName = new Map(models.map((x) => [x.name, x]))
const children: ChildModel[] = []
const relRe = /^\s*([A-Za-z0-9_]+)\s+([A-Za-z0-9_À-ſ]+)\s+@relation\(fields:\s*\[([A-Za-z0-9_]+)\]/gm
for (const [name, { table, body }] of Array.from(allModels)) {
  if (tenantByName.has(name)) continue
  if (name === 'Organization' || name === 'SystemSettings') continue
  let r: RegExpExecArray | null
  relRe.lastIndex = 0
  while ((r = relRe.exec(body))) {
    const [, , targetName, fk] = r
    const parent = tenantByName.get(targetName)
    if (!parent) continue
    children.push({ name, table, fk, parent })
    break
  }
}

const COND = `"orgId" = current_setting('app.org_id', true)`
const childCond = (c: ChildModel) =>
  `EXISTS (SELECT 1 FROM "${c.parent.table}" p WHERE p."id" = "${c.fk}" AND p.${COND})`

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

for (const c of children.sort((a, b) => a.table.localeCompare(b.table))) {
  lines.push(
    `-- ${c.name} (přes ${c.fk} → ${c.parent.table})`,
    `ALTER TABLE "${c.table}" ENABLE ROW LEVEL SECURITY;`,
    `DROP POLICY IF EXISTS org_rls ON "${c.table}";`,
    `CREATE POLICY org_rls ON "${c.table}" FOR ALL TO nanto_app`,
    `  USING (${childCond(c)}) WITH CHECK (${childCond(c)});`,
    '',
  )
}

// Implicitní m:n tabulka Product ↔ Category (sloupce A = Category, B = Product — abecedně)
lines.push(
  '-- _ProductCategories (implicitní m:n, B → products)',
  'ALTER TABLE "_ProductCategories" ENABLE ROW LEVEL SECURITY;',
  'DROP POLICY IF EXISTS org_rls ON "_ProductCategories";',
  'CREATE POLICY org_rls ON "_ProductCategories" FOR ALL TO nanto_app',
  `  USING (EXISTS (SELECT 1 FROM "products" p WHERE p."id" = "B" AND p.${COND}))`,
  `  WITH CHECK (EXISTS (SELECT 1 FROM "products" p WHERE p."id" = "B" AND p.${COND}));`,
  '',
  // Vlastní org: orgPrisma dělá db.organization.update({ where: { id: orgId } }) —
  // bez policy by chyba v routě mohla měnit plán/Stripe cizí org.
  '-- Organization (jen vlastní řádek)',
  'ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;',
  'DROP POLICY IF EXISTS org_rls ON "organizations";',
  'CREATE POLICY org_rls ON "organizations" FOR ALL TO nanto_app',
  `  USING ("id" = current_setting('app.org_id', true)) WITH CHECK ("id" = current_setting('app.org_id', true));`,
  '',
  // Systémová nastavení: aplikace je jen čte
  '-- SystemSettings (nanto_app jen čte)',
  'REVOKE INSERT, UPDATE, DELETE ON "system_settings" FROM nanto_app;',
  '',
)

const out = path.resolve(__dirname, '../prisma/rls.sql')
fs.writeFileSync(out, lines.join('\n'))
console.log(`prisma/rls.sql: ${models.length} tenant tabulek + ${children.length} dětských + _ProductCategories + organizations`)
console.log('tenant:', models.map((x) => x.table).join(', '))
console.log('děti:', children.map((x) => `${x.table}(${x.fk})`).join(', '))
