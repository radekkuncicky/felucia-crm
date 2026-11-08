/**
 * Jednorázový backfill (2026-11-08): zakázky bez místa stavby, jejichž OP má
 * SOD s adresou díla (createZakazkaFromDeal ji do té doby nepřebíral).
 * Vyplněné místo stavby se nepřepisuje.
 *
 *   npx tsx scripts/backfill-misto-stavby.ts --dry-run   # jen vypíše
 *   npx tsx scripts/backfill-misto-stavby.ts             # zapíše
 */
import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { adresaDilaProDeal } from '../lib/adresaDila'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const zakazky = await prisma.zakazka.findMany({
    where: { opId: { not: null }, OR: [{ mistoStavby: null }, { mistoStavby: '' }] },
    select: { id: true, orgId: true, cislo: true, opId: true, organization: { select: { slug: true } } },
  })
  let n = 0
  for (const z of zakazky) {
    const sodCount = await prisma.sod.count({ where: { dealId: z.opId!, orgId: z.orgId, adresaDila: { not: null } } })
    if (sodCount === 0) continue
    const adresa = await adresaDilaProDeal(z.opId!, z.orgId)
    if (!adresa) continue
    n++
    console.log(`${z.organization.slug}\t${z.cislo}\t${adresa}`)
    if (!dryRun) await prisma.zakazka.update({ where: { id: z.id }, data: { mistoStavby: adresa } })
  }
  console.log(`${dryRun ? '[dry-run] ' : ''}${n} zakázek ${dryRun ? 'k doplnění' : 'doplněno'}`)
}

main().finally(() => prisma.$disconnect())
