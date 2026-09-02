import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// RAC (residential single-split) SET jednotky Gree — vnitřní+venkovní jako jeden produkt,
// stejná konvence jako stávající Samsung produkty v kategorii "RAC klimatizace"
// (cena = prodejní/gross, nakladovaCena = netto bez DPH dle ceníku)

const PULAR_POPIS =
  'WIFI, Cold Plasma generátor, 7 stupňů rychlosti ventilátoru, pohyb lamel vodorovně i svisle, ' +
  'funkce temperování na 8°C, funkce I Feel, provozní rozsah chlazení -15 až 43°C, ' +
  'provozní rozsah topení -15 až 24°C, tichý provoz od 21 dB, ModBus ready, on-off kontakt'

const FAIRY_POPIS =
  'WIFI, Cold Plasma generátor, 7 stupňů rychlosti ventilátoru, pohyb lamel vodorovně i svisle, ' +
  'funkce temperování na 8°C, funkce I Feel, provozní rozsah chlazení -15 až 50°C, ' +
  'provozní rozsah topení -25 až 30°C, ModBus ready, on-off kontakt'

const CLIVIA_POPIS =
  'WIFI, Cold Plasma generátor, UVC sterilizátor, 7 stupňů rychlosti ventilátoru, ' +
  'pohyb lamel vodorovně i svisle, funkce temperování na 8°C, plynulé nastavení teploty 8-30°C ' +
  'v režimu topení, funkce I Feel, provozní rozsah chlazení -15 až 50°C, provozní rozsah topení ' +
  '-25 až 30°C, humidity control, tichý provoz od 19 dB, ModBus ready, on-off kontakt'

const AIRY_POPIS =
  'WIFI, bezprůvanová lamela, Cold Plasma generátor, UVC sterilizátor, 7 stupňů rychlosti ventilátoru, ' +
  'pohyb lamel vodorovně i svisle, funkce temperování na 8°C, plynulé nastavení teploty 8-30°C ' +
  'v režimu topení, topení až 10h bez defrostu, funkce I Feel, provozní rozsah chlazení -15 až 50°C, ' +
  'provozní rozsah topení -25 až 30°C, humidity control, tichý provoz od 19 dB, ModBus ready, on-off kontakt'

const CONSOLE_POPIS =
  'WIFI modul, Cold Plasma generátor, 7 stupňů rychlosti ventilátoru, funkce temperování na 8°C, ' +
  'funkce I Feel, provozní rozsah chlazení -15 až 43°C, provozní rozsah topení -22 až 24°C, ' +
  'ModBus ready, on-off kontakt, spodní výdech pro komfortnější distribuci teplého vzduchu'

const PRODUKTY = [
  // PULAR R32
  { serie: 'PULAR', model: 'GWH09AGBXB-K6DNA1A', velikost: 9, vykon: '2,7 / 2,8', trida: 'A++ / A+', gross: 20496, netto: 10248, popis: PULAR_POPIS },
  { serie: 'PULAR', model: 'GWH12AGCXB-K6DNA1A', velikost: 12, vykon: '3,2 / 3,4', trida: 'A++ / A+', gross: 22369, netto: 11185, popis: PULAR_POPIS },
  { serie: 'PULAR', model: 'GWH18AGD-K6DNA1D', velikost: 18, vykon: '4,6 / 5,2', trida: 'A++ / A+', gross: 30875, netto: 15438, popis: PULAR_POPIS },
  { serie: 'PULAR', model: 'GWH24AGD-K6DNA1C', velikost: 24, vykon: '6,2 / 6,5', trida: 'A++ / A+', gross: 41620, netto: 20810, popis: PULAR_POPIS },

  // FAIRY II R32 (barvy WH/SL/BK/CH)
  { serie: 'FAIRY II', model: 'GWH09ACC-K6DNA1F', velikost: 9, vykon: '2,7 / 3,0', trida: 'A++ / A+', gross: 23651, netto: 11826, popis: FAIRY_POPIS },
  { serie: 'FAIRY II', model: 'GWH12ACC-K6DNA1F', velikost: 12, vykon: '3,5 / 3,8', trida: 'A++ / A+', gross: 25139, netto: 12570, popis: FAIRY_POPIS },
  { serie: 'FAIRY II', model: 'GWH18ACDXF-K6DNA1A', velikost: 18, vykon: '5,3 / 5,6', trida: 'A++ / A+', gross: 39321, netto: 19661, popis: FAIRY_POPIS },
  { serie: 'FAIRY II', model: 'GWH24ACE-K6DNA1I', velikost: 24, vykon: '7,1 / 7,8', trida: 'A++ / A+', gross: 46208, netto: 23104, popis: FAIRY_POPIS },

  // CLIVIA R32
  { serie: 'CLIVIA', model: 'GWH09AUCXB-K6DNA2A', velikost: 9, vykon: '2,7 / 3,0', trida: 'A+++ / A++', gross: 26368, netto: 13184, popis: CLIVIA_POPIS },
  { serie: 'CLIVIA', model: 'GWH12AUCXB-K6DNA2A', velikost: 12, vykon: '3,5 / 3,8', trida: 'A++ / A+', gross: 27809, netto: 13905, popis: CLIVIA_POPIS },
  { serie: 'CLIVIA', model: 'GWH18AUDXD-K6DNA2A', velikost: 18, vykon: '5,3 / 5,4', trida: 'A++ / A+', gross: 42124, netto: 21062, popis: CLIVIA_POPIS },
  { serie: 'CLIVIA', model: 'GWH24AUDXF-K6DNA2A', velikost: 24, vykon: '7,1 / 7,3', trida: 'A++ / A+', gross: 50532, netto: 25266, popis: CLIVIA_POPIS },

  // AIRY R32 (barvy WH/SL)
  { serie: 'AIRY', model: 'GWH09AVCXB-K6DNA1B', velikost: 9, vykon: '2,7 / 3,0', trida: 'A+++ / A++', gross: 29827, netto: 14914, popis: AIRY_POPIS },
  { serie: 'AIRY', model: 'GWH12AVCXD-K6DNA1A', velikost: 12, vykon: '3,5 / 3,8', trida: 'A+++ / A++', gross: 31973, netto: 15987, popis: AIRY_POPIS },
  { serie: 'AIRY', model: 'GWH18AVDXE-K6DNA1A', velikost: 18, vykon: '5,3 / 5,6', trida: 'A+++ / A++', gross: 44937, netto: 22469, popis: AIRY_POPIS },
  { serie: 'AIRY', model: 'GWH24AVEXF-K6DNA1A', velikost: 24, vykon: '7,1 / 7,8', trida: 'A+++ / A++', gross: 53334, netto: 26667, popis: AIRY_POPIS },

  // CONSOLE R32
  { serie: 'CONSOLE', model: 'GEH09AA-K6DNA1F', velikost: 9, vykon: '2,7 / 2,8', trida: 'A++ / A+', gross: 35483, netto: 17742, popis: CONSOLE_POPIS },
  { serie: 'CONSOLE', model: 'GEH12AA-K6DNA1A', velikost: 12, vykon: '3,5 / 3,7', trida: 'A++ / A+', gross: 39076, netto: 19538, popis: CONSOLE_POPIS },
  { serie: 'CONSOLE', model: 'GEH18AA-K6DNA1F', velikost: 18, vykon: '5,2 / 5,3', trida: 'A++ / A+', gross: 49062, netto: 24531, popis: CONSOLE_POPIS },
]

async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: 'nanto' } })
  if (!org) throw new Error('NANTO org nenalezena!')
  console.log(`✓ Org: ${org.nazev}`)

  const kategorie = await prisma.category.findFirst({
    where: { orgId: org.id, nazev: 'RAC klimatizace' },
  })
  if (!kategorie) throw new Error('Kategorie "RAC klimatizace" nenalezena!')
  console.log('✓ Kategorie "RAC klimatizace" nalezena')

  let created = 0

  for (const p of PRODUKTY) {
    const nazev = `Gree ${p.serie} ${p.velikost}`
    const kod = p.model

    const existing = await prisma.product.findFirst({
      where: { orgId: org.id, kod },
    })
    if (existing) {
      console.log(`   ~ Přeskočeno (existuje): ${nazev} (${kod})`)
      continue
    }

    await prisma.product.create({
      data: {
        orgId: org.id,
        categories: { connect: { id: kategorie.id } },
        nazev,
        kod,
        produktovaRada: p.serie,
        popis: `${p.popis} | Výkon chlazení/topení: ${p.vykon} kW | En. třída: ${p.trida} | ${p.velikost} kBTU`,
        standardniCena: p.gross,
        nakladovaCena: p.netto,
        jednotka: 'ks',
        aktivni: true,
      },
    })
    console.log(`   ✓ ${nazev} (${kod}) — ${p.gross.toLocaleString('cs-CZ')} Kč / netto ${p.netto.toLocaleString('cs-CZ')} Kč`)
    created++
  }

  console.log(`\n✅ Hotovo! Importováno ${created} produktů do kategorie "RAC klimatizace"`)
}

main()
  .catch(e => { console.error('❌ Chyba:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
