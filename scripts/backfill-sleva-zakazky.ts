/**
 * Jednorázový backfill: položková sleva (%) z aktivní nabídky OP se do 2026-10-14
 * při převodu na zakázku zahazovala (zakázka i vyúčtování měly plnou cenu).
 * Doplní `sleva` do položek zakázky a do položek NESCHVÁLENÝCH vyúčtování.
 * Schválená vyúčtování se nemění — jen se vypíšou k ruční kontrole.
 *
 * Párování: položka zakázky ↔ položka nabídky podle názvu + ceny (a productId, je-li).
 *
 *   npx tsx scripts/backfill-sleva-zakazky.ts --dry-run   # jen vypíše
 *   npx tsx scripts/backfill-sleva-zakazky.ts             # zapíše
 *
 * Před ostrým během udělej zálohu: /root/scripts/backup-db.sh
 */
import 'dotenv/config'
import { prisma } from '../lib/prisma'

const dryRun = process.argv.includes('--dry-run')

const klic = (nazev: string, cena: unknown) => `${nazev.trim().toLowerCase()}|${Number(cena ?? 0)}`

async function main() {
  const zakazky = await prisma.zakazka.findMany({
    where: {
      opId: { not: null },
      op: { quotes: { some: { aktivni: true, items: { some: { sleva: { gt: 0 } } } } } },
    },
    select: {
      id: true, cislo: true, nazev: true,
      organization: { select: { slug: true } },
      polozky: { select: { id: true, nazev: true, productId: true, prodejniCena: true, sleva: true } },
      vyuctovani: {
        select: {
          id: true, cislo: true, stav: true,
          polozky: { select: { id: true, nazev: true, prodejniCena: true, sleva: true } },
        },
      },
      op: {
        select: {
          quotes: {
            where: { aktivni: true },
            take: 1,
            select: { items: { select: { nazev: true, productId: true, cenaZaKus: true, sleva: true } } },
          },
        },
      },
    },
  })

  let zakPolozek = 0
  let vyuPolozek = 0
  const kKontrole: string[] = []

  for (const z of zakazky) {
    const items = z.op?.quotes[0]?.items.filter(i => Number(i.sleva) > 0) ?? []
    const slevaPodle = new Map(items.map(i => [klic(i.nazev ?? '', i.cenaZaKus), Number(i.sleva)]))
    const zmeny: string[] = []

    for (const p of z.polozky) {
      const s = slevaPodle.get(klic(p.nazev, p.prodejniCena))
      if (s == null || Number(p.sleva) === s) continue
      zmeny.push(`  zakázka: ${p.nazev} → ${s} %`)
      zakPolozek++
      if (!dryRun) await prisma.zakazkaPolozka.update({ where: { id: p.id }, data: { sleva: s } })
    }

    for (const v of z.vyuctovani) {
      for (const p of v.polozky) {
        const s = slevaPodle.get(klic(p.nazev, p.prodejniCena))
        if (s == null || Number(p.sleva) === s) continue
        if (v.stav === 'SCHVALENO') {
          kKontrole.push(`${z.organization.slug} ${z.cislo} ${v.cislo}: ${p.nazev} (sleva ${s} % v nabídce)`)
          continue
        }
        zmeny.push(`  ${v.cislo}: ${p.nazev} → ${s} %`)
        vyuPolozek++
        if (!dryRun) await prisma.vyuctovaniPolozka.update({ where: { id: p.id }, data: { sleva: s } })
      }
    }

    if (zmeny.length) console.log(`${z.organization.slug} ${z.cislo} ${z.nazev}\n${zmeny.join('\n')}`)
  }

  console.log(`\n${dryRun ? '[DRY-RUN] ' : ''}Položek zakázek: ${zakPolozek}, položek neschválených vyúčtování: ${vyuPolozek}`)
  if (kKontrole.length) {
    console.log(`\nSchválená vyúčtování bez slevy (neměněno, zkontrolovat ručně): ${kKontrole.length}`)
    for (const r of kKontrole) console.log(`  ${r}`)
  }
}

main().finally(() => prisma.$disconnect())
