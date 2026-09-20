/**
 * Jednorázová migrace: podklady zakázek (zakazka_dokumenty) uložené jako
 * base64 data: URI přímo v DB se přesunou na disk do
 * public/uploads/zakazky/<zakazkaId>/dok_<ts>_<nazev> a v DB zůstane jen cesta.
 * Base64 v DB rozbíjel mobilní appku (několik MB JSON, data: URI nejde otevřít).
 *
 *   npx tsx scripts/migrate-podklady-to-disk.ts --dry-run   # jen vypíše
 *   npx tsx scripts/migrate-podklady-to-disk.ts             # zapíše
 *
 * Idempotentní — řádky, které už mají cestu, přeskočí.
 * Před ostrým během udělej zálohu: /root/scripts/backup-db.sh
 */
import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { PodkladTypeError, parseDataUri, ulozitPodklad } from '../lib/zakazkaPodklady'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const rows = await prisma.zakázkaDokument.findMany({
    where: { url: { startsWith: 'data:' } },
    select: { id: true, zakazkaId: true, nazev: true, mime: true },
  })
  console.log(`${rows.length} dokumentů k migraci${dryRun ? ' (dry-run)' : ''}`)

  let ok = 0
  for (const row of rows) {
    // url tahám per řádek, ať nedržím všechny bloby v paměti najednou
    const { url } = await prisma.zakázkaDokument.findUniqueOrThrow({
      where: { id: row.id }, select: { url: true },
    })
    const parsed = parseDataUri(url)
    if (!parsed) {
      console.warn(`  ! ${row.id} ${row.nazev}: nerozpoznaný data: URI, přeskakuji`)
      continue
    }
    const kb = Math.round(parsed.buffer.length / 1024)
    if (dryRun) {
      console.log(`  ${row.id} ${row.nazev} (${row.mime}, ${kb} kB) → /uploads/zakazky/${row.zakazkaId}/…`)
      continue
    }
    let novaUrl: string
    try { novaUrl = await ulozitPodklad(row.zakazkaId, parsed.buffer, row.nazev) } catch (e) {
      if (e instanceof PodkladTypeError) { console.warn(`  ! ${row.id} ${row.nazev}: nepovolený typ souboru, zůstává v DB`); continue }
      throw e
    }
    await prisma.zakázkaDokument.update({
      where: { id: row.id },
      data: { url: novaUrl, ...(row.mime === 'application/octet-stream' ? { mime: parsed.mime } : {}) },
    })
    console.log(`  ✓ ${row.id} ${row.nazev} (${kb} kB) → ${novaUrl}`)
    ok++
  }
  console.log(dryRun ? 'Hotovo (nic nezapsáno).' : `Hotovo: ${ok}/${rows.length} přesunuto.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
