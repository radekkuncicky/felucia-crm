import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// AIRY R32 vnitřní jednotky pro MULTISPLITOVÉ SESTAVY FREE-MATCH (FJM) — kategorie
// "MULTISPLIT klimatizace", stejná konvence jako Samsung FJM (kod "<model> - FJM",
// cena = prodejní/gross, nakladovaCena = netto bez DPH). Prodávají se samostatně
// (bez venkovní jednotky, ta je společná pro celou multisplit sestavu).

const POPIS =
  'WIFI, bezprůvanová lamela, Cold Plasma generátor, UVC sterilizátor, 7 stupňů rychlosti ' +
  'ventilátoru, pohyb lamel vodorovně i svisle, funkce temperování na 8°C, funkce I Feel, ' +
  'humidity control funkce, tichý provoz od 19 dB, ModBus ready, on-off kontakt, volitelně: Fresh Air modul'

const PRODUKTY = [
  { model: 'GWH07AVCXB-K6DNA1B', velikost: 7, vykon: '2,1 / 2,7', gross: 11189, netto: 5595 },
  { model: 'GWH09AVCXB-K6DNA1B', velikost: 9, vykon: '2,7 / 3,0', gross: 11348, netto: 5674 },
  { model: 'GWH12AVCXD-K6DNA1A', velikost: 12, vykon: '3,5 / 3,8', gross: 11976, netto: 5988 },
  { model: 'GWH18AVDXE-K6DNA1A', velikost: 18, vykon: '5,3 / 5,6', gross: 16571, netto: 8286 },
  { model: 'GWH24AVEXF-K6DNA1A', velikost: 24, vykon: '7,1 / 7,8', gross: 20680, netto: 10340 },
]

async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: 'nanto' } })
  if (!org) throw new Error('NANTO org nenalezena!')
  console.log(`✓ Org: ${org.nazev}`)

  const kategorie = await prisma.category.findFirst({
    where: { orgId: org.id, nazev: 'MULTISPLIT klimatizace' },
  })
  if (!kategorie) throw new Error('Kategorie "MULTISPLIT klimatizace" nenalezena!')
  console.log('✓ Kategorie "MULTISPLIT klimatizace" nalezena')

  let created = 0

  for (const p of PRODUKTY) {
    const nazev = `Gree AIRY ${p.velikost}`
    const kod = `${p.model} - FJM`

    const existing = await prisma.product.findFirst({
      where: { orgId: org.id, kod },
    })
    if (existing) {
      console.log(`   ~ Přeskočeno (existuje): ${nazev}`)
      continue
    }

    await prisma.product.create({
      data: {
        orgId: org.id,
        categories: { connect: { id: kategorie.id } },
        nazev,
        kod,
        produktovaRada: 'AIRY',
        popis: `${POPIS} | Výkon chlazení/topení: ${p.vykon} kW | ${p.velikost} kBTU`,
        standardniCena: p.gross,
        nakladovaCena: p.netto,
        jednotka: 'ks',
        aktivni: true,
      },
    })
    console.log(`   ✓ ${nazev} (${kod}) — ${p.gross.toLocaleString('cs-CZ')} Kč / netto ${p.netto.toLocaleString('cs-CZ')} Kč`)
    created++
  }

  console.log(`\n✅ Hotovo! Importováno ${created} produktů do kategorie "MULTISPLIT klimatizace"`)
}

main()
  .catch(e => { console.error('❌ Chyba:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
