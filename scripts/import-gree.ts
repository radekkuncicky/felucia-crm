import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Vnitřní jednotky — formát: serie, model, vykon, velikost, cena
const VNITRNI = [
  // PULAR
  { serie: 'PULAR', model: 'GWH07AGA-K6DNA1A/I', vykon: '2,2 / 2,4', velikost: 7, cena: 6740 },
  { serie: 'PULAR', model: 'GWH09AGBXB-K6DNA1A/I', vykon: '2,7 / 2,8', velikost: 9, cena: 7410 },
  { serie: 'PULAR', model: 'GWH12AGCXB-K6DNA1A/I', vykon: '3,2 / 3,4', velikost: 12, cena: 8744 },
  { serie: 'PULAR', model: 'GWH18AGD-K6DNA1D/I', vykon: '4,6 / 5,2', velikost: 18, cena: 10530 },
  { serie: 'PULAR', model: 'GWH24AGD-K6DNA1C/I', vykon: '6,2 / 6,5', velikost: 24, cena: 12586 },

  // FAIRY II
  { serie: 'FAIRY II', model: 'GWH09ACC-K6DNA1F/I WH,SL,BK,CH', vykon: '2,7 / 3,0', velikost: 9, cena: 8816 },
  { serie: 'FAIRY II', model: 'GWH12ACC-K6DNA1F/I WH,SL,BK,CH', vykon: '3,5 / 3,8', velikost: 12, cena: 9101 },
  { serie: 'FAIRY II', model: 'GWH18ACDXF-K6DNA1A/I WH,SL,BK,CH', vykon: '5,3 / 5,6', velikost: 18, cena: 11585 },
  { serie: 'FAIRY II', model: 'GWH24ACE-K6DNA1I/I WH,SL,BK,CH', vykon: '7,1 / 7,8', velikost: 24, cena: 14646 },

  // CLIVIA
  { serie: 'CLIVIA', model: 'GWH07AUCXB-K6DNA2A/I', vykon: '2,2 / 2,4', velikost: 7, cena: 9325 },
  { serie: 'CLIVIA', model: 'GWH09AUCXB-K6DNA2A/I', vykon: '2,7 / 3,0', velikost: 9, cena: 9599 },
  { serie: 'CLIVIA', model: 'GWH12AUCXB-K6DNA2A/I', vykon: '3,5 / 3,8', velikost: 12, cena: 9943 },
  { serie: 'CLIVIA', model: 'GWH18AUDXD-K6DNA2A/I', vykon: '5,3 / 5,4', velikost: 18, cena: 12193 },
  { serie: 'CLIVIA', model: 'GWH24AUDXF-K6DNA2A/I', vykon: '7,1 / 7,3', velikost: 24, cena: 15114 },

  // U-CROWN
  { serie: 'U-CROWN', model: 'GWH09UB-K6DNA4A/I CH,SL', vykon: '2,7 / 3,2', velikost: 9, cena: 11680 },
  { serie: 'U-CROWN', model: 'GWH12UB-K6DNA4A/I SL', vykon: '3,5 / 4,0', velikost: 12, cena: 12720 },
  { serie: 'U-CROWN', model: 'GWH18UC-K6DNA4A/I SL', vykon: '5,3 / 5,3', velikost: 18, cena: 12915 },

  // CONSOLE
  { serie: 'CONSOLE', model: 'GEH09AA-K6DNA1E/I', vykon: '2,7 / 2,8', velikost: 9, cena: 13566 },
  { serie: 'CONSOLE', model: 'GEH12AA-K6DNA1E/I', vykon: '3,5 / 3,8', velikost: 12, cena: 14167 },
  { serie: 'CONSOLE', model: 'GEH18AA-K6DNA1E/I', vykon: '5,2 / 5,3', velikost: 18, cena: 14597 },
]

// Venkovní (kondenzační) jednotky FREE-MATCH R32
const VENKOVNI = [
  { model: 'GWHD(14)NK6OO', vykon: '4,1 / 4,4', velikost: 14, cena: 30300 },
  { model: 'GWHD(18)NK6OO', vykon: '5,3 / 5,6', velikost: 18, cena: 31990 },
  { model: 'GWHD(21)NK6OO', vykon: '6,1 / 6,5', velikost: 21, cena: 39510 },
  { model: 'GWHD(24)NK6OO', vykon: '7,1 / 8,6', velikost: 24, cena: 46200 },
  { model: 'GWHD(28)NK6OO', vykon: '8,0 / 9,5', velikost: 28, cena: 50600 },
  { model: 'GWHD(36)NK6OO', vykon: '10,6 / 12,0', velikost: 36, cena: 70019 },
  { model: 'GWHD(42)NK6OO', vykon: '12,1 / 13,0', velikost: 42, cena: 79588 },
]

async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: 'nanto' } })
  if (!org) throw new Error('NANTO org nenalezena!')
  console.log(`✓ Org: ${org.nazev}`)

  // Vytvoř nebo najdi kategorii "GREE klimatizace"
  let kategorie = await prisma.category.findFirst({
    where: { orgId: org.id, nazev: 'GREE klimatizace' },
  })
  if (!kategorie) {
    kategorie = await prisma.category.create({
      data: { orgId: org.id, nazev: 'GREE klimatizace' },
    })
    console.log('✓ Kategorie "GREE klimatizace" vytvořena')
  } else {
    console.log('✓ Kategorie "GREE klimatizace" nalezena')
  }

  let created = 0

  // Import vnitřních jednotek
  console.log('\n📦 Importuji vnitřní jednotky...')
  for (const p of VNITRNI) {
    const nazev = `GREE ${p.serie} - ${p.vykon} - ${p.velikost} - vnitřní`
    const kod = `GREE-${p.serie.replace(/\s+/g, '-').toUpperCase()}-${p.velikost}`

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
        popis: `Model: ${p.model} | Výkon chlazení/topení: ${p.vykon} kW | Velikost: ${p.velikost}`,
        standardniCena: p.cena,
        nakladovaCena: Math.round(p.cena * 0.65),
        jednotka: 'ks',
        aktivni: true,
      },
    })
    console.log(`   ✓ ${nazev} — ${p.cena.toLocaleString('cs-CZ')} Kč`)
    created++
  }

  // Import venkovních jednotek
  console.log('\n📦 Importuji venkovní (kondenzační) jednotky...')
  for (const p of VENKOVNI) {
    const nazev = `GREE KONDENZAČNÍ R32 - ${p.vykon} - ${p.velikost} - venkovní`
    const kod = `GREE-KOND-${p.velikost}`

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
        popis: `Model: ${p.model} | Výkon chlazení/topení: ${p.vykon} kW | Velikost: ${p.velikost} | DC Inverter, FREE-MATCH R32`,
        standardniCena: p.cena,
        nakladovaCena: Math.round(p.cena * 0.65),
        jednotka: 'ks',
        aktivni: true,
      },
    })
    console.log(`   ✓ ${nazev} — ${p.cena.toLocaleString('cs-CZ')} Kč`)
    created++
  }

  console.log(`\n✅ Hotovo! Importováno ${created} produktů do kategorie "GREE klimatizace"`)
}

main()
  .catch(e => { console.error('❌ Chyba:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
