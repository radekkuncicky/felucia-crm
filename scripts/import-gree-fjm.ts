import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Venkovní jednotky Gree FREE-MATCH (FJM multisplit) — kategorie "MULTISPLIT klimatizace",
// stejná konvence jako stávající Samsung FJM venkovní jednotky (cena = prodejní/gross,
// nakladovaCena = netto bez DPH dle ceníku)

const POPIS =
  'DC Inverter technologie, možnost napojení až 5 vnitřních jednotek dle kombinační tabulky, ' +
  'vyhřívání kompresoru a šasí, automatické odmrazování, provozní rozsah chlazení -15 až 43°C, ' +
  'provozní rozsah topení -22 až 24°C'

const PRODUKTY = [
  { model: 'GWHD(14)NK6OO', velikost: 14, vykon: '4,1 / 4,4', trida: 'A++ / A+', gross: 31210, netto: 15605 },
  { model: 'GWHD(18)NK6OO', velikost: 18, vykon: '5,3 / 5,6', trida: 'A++ / A+', gross: 32950, netto: 16475 },
  { model: 'GWHD(21)NK6OO', velikost: 21, vykon: '6,1 / 6,5', trida: 'A++ / A+', gross: 40695, netto: 20348 },
  { model: 'GWHD(24)NK6OO', velikost: 24, vykon: '7,1 / 8,6', trida: 'A++ / A+', gross: 47586, netto: 23793 },
  { model: 'GWHD(28)NK6OO', velikost: 28, vykon: '8,0 / 9,5', trida: 'A++ / A+', gross: 52118, netto: 26059 },
  { model: 'GWHD(36)NK6OO', velikost: 36, vykon: '10,6 / 12,0', trida: 'A++ / A+', gross: 72119, netto: 36060 },
  { model: 'GWHD(42)NK6OO', velikost: 42, vykon: '12,1 / 13,0', trida: 'A++ / A+', gross: 81975, netto: 40988 },
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
    const nazev = `Venkovní jednotka GREE - ${p.model}`
    const kod = p.model

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
        popis: `${POPIS} | Výkon chlazení/topení: ${p.vykon} kW | En. třída: ${p.trida} | ${p.velikost} kBTU`,
        standardniCena: p.gross,
        nakladovaCena: p.netto,
        jednotka: 'ks',
        aktivni: true,
      },
    })
    console.log(`   ✓ ${nazev} — ${p.gross.toLocaleString('cs-CZ')} Kč / netto ${p.netto.toLocaleString('cs-CZ')} Kč`)
    created++
  }

  console.log(`\n✅ Hotovo! Importováno ${created} produktů do kategorie "MULTISPLIT klimatizace"`)
}

main()
  .catch(e => { console.error('❌ Chyba:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
