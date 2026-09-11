/**
 * Jednorázový backfill: položky zakázek vzniklé z OP (polozkyZAktivniNabidky)
 * do teď nikdy nekopírovaly nákupní cenu z nabídky (lib/zakazkaWorkflow.ts) —
 * jen prodejní cenu. Doplní zakazka_polozky.nakupniCena z odpovídající položky
 * aktivní nabídky dané zakázky, spárované podle pořadí a názvu.
 *
 *   npx tsx scripts/backfill-zakazka-polozka-nakupky.ts --dry-run   # jen spočítá
 *   npx tsx scripts/backfill-zakazka-polozka-nakupky.ts             # zapíše
 *
 * Před ostrým během udělej zálohu: /root/scripts/backup-db.sh
 */
import 'dotenv/config'
import { prisma } from '../lib/prisma'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const perOrg = await prisma.$queryRaw<{ slug: string; pocet: bigint }[]>`
    SELECT o.slug, count(*)::bigint AS pocet
    FROM zakazka_polozky zp
    JOIN zakazky z ON z.id = zp."zakazkaId"
    JOIN organizations o ON o.id = z."orgId"
    JOIN quotes q ON q."dealId" = z."opId" AND q.aktivni = true
    JOIN quote_items qi ON qi."quoteId" = q.id AND qi.poradi = zp.poradi AND qi.nazev = zp.nazev
    WHERE z."opId" IS NOT NULL
      AND zp."nakupniCena" IS NULL
      AND qi."nakupniCena" IS NOT NULL
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
    UPDATE zakazka_polozky zp
    SET "nakupniCena" = qi."nakupniCena"
    FROM zakazky z, quotes q, quote_items qi
    WHERE z.id = zp."zakazkaId"
      AND q."dealId" = z."opId" AND q.aktivni = true
      AND qi."quoteId" = q.id AND qi.poradi = zp.poradi AND qi.nazev = zp.nazev
      AND z."opId" IS NOT NULL
      AND zp."nakupniCena" IS NULL
      AND qi."nakupniCena" IS NOT NULL
  `
  console.log(`Aktualizováno položek: ${updated}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
