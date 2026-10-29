/**
 * Jednorázově vyplní Organization.aiContext pro NANTO s.r.o. (ostatní firmy nechá být).
 *
 *   npx tsx scripts/seed-ai-context-nanto.ts              → najde org a vypíše její ID, nic nezapíše
 *   npx tsx scripts/seed-ai-context-nanto.ts --potvrdit <ID> → zapíše kontext do org s tímto ID
 *
 * Text je doslova ze sekce „Kontext NANTO" (audit NANTO, říjen 2026).
 */
import { prisma } from '../lib/prisma'

const KONTEXT_NANTO = `Zákazníci jsou B2C. Firma dělá tepelná čerpadla, klimatizace, rekuperace a podlahové topení.

Lidé: jednatelé Radek a Tomáš, montáže dělají Radek, Tomáš a Veči, podle potřeby externisté.

Průběh zakázky: lead (Google Ads, doporučení) - telefonát se zákazníkem - nabídka ve Felucii - follow-up po 3 dnech - smlouva o dílo - záloha 70 procent před objednáním materiálu (u klimatizací obvykle bez zálohy) - objednávka materiálu - příprava montáže (instrukce montérům, technické listy, telefonát zákazníkovi před montáží) - montáž - telefonát po montáži (spokojenost, nedodělky) - vyúčtování manažerem zakázky - faktura.

Technici nevidí a nenastavují ceny. Cokoli přidají, musí projít manažerem zakázky, který odpovídá za finální vyúčtování.

Servisní výjezdy jsou samostatný typ zakázky.

Typická místa, kde asistent pomůže nejvíc: zapomenutý follow-up nabídky, příprava montáže, poznámky z terénu, připomínky telefonátů po montáži.`

async function main() {
  const i = process.argv.indexOf('--potvrdit')
  const potvrzeneId = i >= 0 ? process.argv[i + 1] : null

  const kandidati = await prisma.organization.findMany({
    where: { nazev: { contains: 'NANTO', mode: 'insensitive' } },
    select: { id: true, nazev: true, slug: true, ico: true, aiContext: true },
  })

  if (!potvrzeneId) {
    if (kandidati.length === 0) {
      console.log('Žádná organizace s „NANTO" v názvu.')
      return
    }
    console.log('Nalezené organizace:')
    for (const o of kandidati) {
      console.log(`  ${o.id}  ${o.nazev}  (slug ${o.slug}, IČO ${o.ico ?? '—'}, kontext ${o.aiContext ? 'VYPLNĚN' : 'prázdný'})`)
    }
    console.log('\nZápis: npx tsx scripts/seed-ai-context-nanto.ts --potvrdit <ID>')
    return
  }

  const org = kandidati.find(o => o.id === potvrzeneId)
  if (!org) throw new Error(`ID ${potvrzeneId} není mezi organizacemi NANTO — nic nezapisuji`)

  await prisma.organization.update({ where: { id: org.id }, data: { aiContext: KONTEXT_NANTO } })
  console.log(`Zapsáno: ${org.nazev} (${org.id}), ${KONTEXT_NANTO.length} znaků.`)
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
