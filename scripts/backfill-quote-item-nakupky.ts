/**
 * Jednorázový backfill: položky nabídek z knihovny, které vznikly bez snapshotu
 * nákupní ceny (web API ji do 2026-09-10 nekopíroval), dostanou aktuální
 * nákladovou cenu produktu. Marže se tím nemění — UI už dnes používá stejný
 * fallback (item.nakupniCena ?? product.nakladovaCena).
 *
 *   npx tsx scripts/backfill-quote-item-nakupky.ts --dry-run   # jen spočítá
 *   npx tsx scripts/backfill-quote-item-nakupky.ts             # zapíše
 *
 * Před ostrým během udělej zálohu: /root/scripts/backup-db.sh
 */
import 'dotenv/config'
import { prisma } from '../lib/prisma'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const perOrg = await prisma.$queryRaw<{ slug: string; pocet: bigint }[]>`
    SELECT o.slug, count(*)::bigint AS pocet
    FROM quote_items qi
    JOIN products p ON p.id = qi."productId"
    JOIN organizations o ON o.id = p."orgId"
    WHERE qi."nakupniCena" IS NULL AND p."nakupniCena" IS NOT NULL
    GROUP BY o.slug ORDER BY o.slug
  `
  const celkem = perOrg.reduce((s, r) => s + Number(r.pocet), 0)
  console.log(`Položek k doplnění: ${celkem}`)
  for (const r of perOrg) console.log(`  ${r.slug}: ${r.pocet}`)

  if (dryRun) {
    console.log('--dry-run: nic nezapisuji')
    return
  }
  if (celkem === 0) return

  const updated = await prisma.$executeRaw`
    UPDATE quote_items qi
    SET "nakupniCena" = p."nakupniCena"
    FROM products p
    WHERE p.id = qi."productId"
      AND qi."nakupniCena" IS NULL
      AND p."nakupniCena" IS NOT NULL
  `
  console.log(`Aktualizováno položek: ${updated}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
