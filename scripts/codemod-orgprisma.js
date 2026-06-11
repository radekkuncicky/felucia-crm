#!/usr/bin/env node
/**
 * Codemod: migrace API route na orgPrisma.
 * Zpracuje jen soubory s kanonickým vzorem `const orgId = session.user.orgId`:
 *  - import { prisma } from '@/lib/prisma'  →  import { orgPrisma } from '@/lib/orgPrisma'
 *  - za každý `const orgId = ...` vloží `const db = orgPrisma(orgId)`
 *  - `prisma.` → `db.`
 * Soubory mimo vzor vypíše a nechá beze změny. Bezpečnostní síť: tsc.
 *
 * Použití: node scripts/codemod-orgprisma.js <soubor...>
 */
const fs = require('fs')

const ORGID_RE =
  /^(\s*)const (?:orgId|\{[^}]*\borgId\b[^}]*\}) = session!?\.user(?:\.orgId)?\b.*$/

let changed = 0
const skipped = []

for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, 'utf8')
  if (!src.includes("from '@/lib/prisma'")) continue
  if (!ORGID_RE.test(src.split('\n').find((l) => ORGID_RE.test(l)) ?? '')) {
    skipped.push(file)
    continue
  }

  const out = src
    .split('\n')
    .flatMap((line) => {
      const m = line.match(ORGID_RE)
      if (m) return [line, `${m[1]}const db = orgPrisma(orgId)`]
      return [line]
    })
    .join('\n')
    .replace(
      /import \{ prisma \} from '@\/lib\/prisma'/g,
      "import { orgPrisma } from '@/lib/orgPrisma'"
    )
    .replace(/\bprisma\./g, 'db.')

  fs.writeFileSync(file, out)
  changed++
}

console.log(`změněno: ${changed}`)
if (skipped.length) {
  console.log('přeskočeno (ruční migrace):')
  for (const f of skipped) console.log('  ' + f)
}
