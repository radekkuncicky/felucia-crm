/**
 * Jednorázový backfill (sklad v2): položky zakázek vzniklé z OP do teď
 * nepřenášely vazbu na katalogový produkt (QuoteItem.productId →
 * ZakazkaPolozka.productId, lib/zakazkaWorkflow.ts). Doplní productId
 * z odpovídající položky aktivní nabídky (pořadí + název) a následně
 * sklad_pohyby.productId přes polozkaId.
 *
 *   npx tsx scripts/backfill-zakazka-polozka-productid.ts --dry-run   # jen spočítá
 *   npx tsx scripts/backfill-zakazka-polozka-productid.ts             # zapíše
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
    JOIN products p ON p.id = qi."productId" AND p."orgId" = z."orgId"
    WHERE z."opId" IS NOT NULL
      AND zp."productId" IS NULL
    GROUP BY o.slug ORDER BY o.slug
  `
  const celkem = perOrg.reduce((s, r) => s + Number(r.pocet), 0)
  console.log(`Položek zakázek k napárování: ${celkem}`)
  for (const r of perOrg) console.log(`  ${r.slug}: ${r.pocet}`)

  const pohyby = await prisma.$queryRaw<{ pocet: bigint }[]>`
    SELECT count(*)::bigint AS pocet
    FROM sklad_pohyby sp
    JOIN zakazka_polozky zp ON zp.id = sp."polozkaId"
    LEFT JOIN quotes q ON q."dealId" = (SELECT "opId" FROM zakazky WHERE id = zp."zakazkaId") AND q.aktivni = true
    LEFT JOIN quote_items qi ON qi."quoteId" = q.id AND qi.poradi = zp.poradi AND qi.nazev = zp.nazev
    WHERE sp."productId" IS NULL
      AND coalesce(zp."productId", qi."productId") IS NOT NULL
  `
  console.log(`Pohybů skladu k napárování: ${pohyby[0]?.pocet ?? 0}`)

  if (dryRun) {
    console.log('--dry-run: nic nezapisuji')
    return
  }

  const updated = await prisma.$executeRaw`
    UPDATE zakazka_polozky zp
    SET "productId" = qi."productId"
    FROM zakazky z, quotes q, quote_items qi, products p
    WHERE z.id = zp."zakazkaId"
      AND q."dealId" = z."opId" AND q.aktivni = true
      AND qi."quoteId" = q.id AND qi.poradi = zp.poradi AND qi.nazev = zp.nazev
      AND p.id = qi."productId" AND p."orgId" = z."orgId"
      AND z."opId" IS NOT NULL
      AND zp."productId" IS NULL
  `
  console.log(`Aktualizováno položek zakázek: ${updated}`)

  const updatedPohyby = await prisma.$executeRaw`
    UPDATE sklad_pohyby sp
    SET "productId" = zp."productId"
    FROM zakazka_polozky zp
    WHERE zp.id = sp."polozkaId"
      AND sp."productId" IS NULL
      AND zp."productId" IS NOT NULL
  `
  console.log(`Aktualizováno pohybů skladu: ${updatedPohyby}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
