import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Vnitřní jednotky Gree pro MULTISPLITOVÉ SESTAVY FREE-MATCH (FJM) — kategorie
// "MULTISPLIT klimatizace", kod "<model> - FJM", cena = prodejní/gross,
// nakladovaCena = netto bez DPH. Prodávají se samostatně (venkovní jednotka je
// společná pro celou multisplit sestavu, viz scripts/import-gree-fjm.ts).
// Název: "Gree <Série> - <výkon>"

const PULAR_POPIS =
  'WIFI modul, Cold Plasma generátor, 7 stupňů rychlosti ventilátoru, pohyb lamel vodorovně i svisle, ' +
  'funkce temperování na 8°C, funkce I Feel, tichý provoz od 21 dB, ModBus ready, on-off kontakt'

const FAIRY_POPIS =
  'WIFI modul, Cold Plasma generátor, 7 stupňů rychlosti ventilátoru, pohyb lamel vodorovně i svisle, ' +
  'funkce temperování na 8°C, funkce I Feel, ModBus ready, on-off kontakt'

const CLIVIA_POPIS =
  'WIFI modul, Cold Plasma generátor, UVC sterilizátor, 7 stupňů rychlosti ventilátoru, ' +
  'pohyb lamel vodorovně i svisle, funkce temperování na 8°C, funkce I Feel, humidity control funkce, ' +
  'tichý provoz od 19 dB, ModBus ready, on-off kontakt'

const CONSOLE_POPIS =
  'WIFI modul, Cold Plasma generátor, 7 stupňů rychlosti ventilátoru, funkce temperování na 8°C, ' +
  'funkce I Feel, ModBus ready, on-off kontakt, spodní výdech pro komfortnější distribuci teplého vzduchu při vytápění'

const KAZETA_POPIS =
  '4 stupně rychlosti ventilátoru, funkce I Feel, infra dálkový ovladač, nástěnný drátový ovladač, ' +
  'bílý design, ModBus ready, on-off kontakt'

const PRODUKTY = [
  // PULAR
  { serie: 'Pular', model: 'GWH07AGA-K6DNA1A', velikost: 7, vykon: '2,2 / 2,4', gross: 6942, netto: 3471, popis: PULAR_POPIS },
  { serie: 'Pular', model: 'GWH09AGBXB-K6DNA1A', velikost: 9, vykon: '2,7 / 2,8', gross: 7632, netto: 3816, popis: PULAR_POPIS },
  { serie: 'Pular', model: 'GWH12AGCXB-K6DNA1A', velikost: 12, vykon: '3,2 / 3,4', gross: 9006, netto: 4503, popis: PULAR_POPIS },
  { serie: 'Pular', model: 'GWH18AGD-K6DNA1D', velikost: 18, vykon: '4,6 / 5,2', gross: 10845, netto: 5423, popis: PULAR_POPIS },
  { serie: 'Pular', model: 'GWH24AGD-K6DNA1C', velikost: 24, vykon: '6,2 / 6,5', gross: 12963, netto: 6482, popis: PULAR_POPIS },

  // FAIRY II
  { serie: 'Fairy II', model: 'GWH09ACC-K6DNA1F', velikost: 9, vykon: '2,7 / 3,0', gross: 8948, netto: 4474, popis: FAIRY_POPIS },
  { serie: 'Fairy II', model: 'GWH12ACC-K6DNA1F', velikost: 12, vykon: '3,5 / 3,8', gross: 9237, netto: 4619, popis: FAIRY_POPIS },
  { serie: 'Fairy II', model: 'GWH18ACDXF-K6DNA1A', velikost: 18, vykon: '5,3 / 5,6', gross: 11758, netto: 5879, popis: FAIRY_POPIS },
  { serie: 'Fairy II', model: 'GWH24ACE-K6DNA1I', velikost: 24, vykon: '7,1 / 7,8', gross: 14865, netto: 7433, popis: FAIRY_POPIS },

  // CLIVIA
  { serie: 'Clivia', model: 'GWH07AUCXB-K6DNA2A', velikost: 7, vykon: '2,2 / 2,4', gross: 9604, netto: 4802, popis: CLIVIA_POPIS },
  { serie: 'Clivia', model: 'GWH09AUCXB-K6DNA2A', velikost: 9, vykon: '2,7 / 3,0', gross: 9887, netto: 4944, popis: CLIVIA_POPIS },
  { serie: 'Clivia', model: 'GWH12AUCXB-K6DNA2A', velikost: 12, vykon: '3,5 / 3,8', gross: 10241, netto: 5121, popis: CLIVIA_POPIS },
  { serie: 'Clivia', model: 'GWH18AUDXD-K6DNA2A', velikost: 18, vykon: '5,3 / 5,4', gross: 12558, netto: 6279, popis: CLIVIA_POPIS },
  { serie: 'Clivia', model: 'GWH24AUDXF-K6DNA2A', velikost: 24, vykon: '7,1 / 7,3', gross: 15567, netto: 7784, popis: CLIVIA_POPIS },

  // CONSOLE
  { serie: 'Console', model: 'GEH09AA-K6DNA1E', velikost: 9, vykon: '2,7 / 2,8', gross: 13973, netto: 6987, popis: CONSOLE_POPIS },
  { serie: 'Console', model: 'GEH12AA-K6DNA1E', velikost: 12, vykon: '3,5 / 3,7', gross: 14592, netto: 7296, popis: CONSOLE_POPIS },
  { serie: 'Console', model: 'GEH18AA-K6DNA1E', velikost: 18, vykon: '5,2 / 5,3', gross: 15034, netto: 7517, popis: CONSOLE_POPIS },

  // PODSTROPNĚ-PARAPETNÍ
  { serie: 'Podstropně-parapetní', model: 'GTH(09)CA-K6DNA1A', velikost: 9, vykon: '2,6 / 2,7', gross: 8153, netto: 4077, popis: KAZETA_POPIS },
  { serie: 'Podstropně-parapetní', model: 'GTH(12)CA-K6DNA1A', velikost: 12, vykon: '3,5 / 4,0', gross: 8663, netto: 4332, popis: KAZETA_POPIS },
  { serie: 'Podstropně-parapetní', model: 'GTH(18)CA-K6DNA1A', velikost: 18, vykon: '4,5 / 5,0', gross: 9301, netto: 4651, popis: KAZETA_POPIS },
  { serie: 'Podstropně-parapetní', model: 'GTH(24)CB-K6DNA2A', velikost: 24, vykon: '7,1 / 8,0', gross: 11381, netto: 5691, popis: KAZETA_POPIS },
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
    const nazev = `Gree ${p.serie} - ${p.vykon}`
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
        produktovaRada: p.serie,
        popis: `${p.popis} | Výkon chlazení/topení: ${p.vykon} kW | ${p.velikost} kBTU`,
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
