/**
 * Demo seed — creates a demo org + user + realistic HVAC mock data.
 * Run: npx ts-node -e "require('./prisma/seed-demo')"
 * Or:  npx tsx prisma/seed-demo.ts
 */

import { PrismaClient, StavDealu, Technologie, TypAktivity, TypKlienta } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding demo org...')

  // Cleanup existing demo data
  const existing = await prisma.organization.findFirst({ where: { slug: 'demo' } })
  if (existing) {
    // Delete org and all cascaded data
    await prisma.activity.deleteMany({ where: { deal: { orgId: existing.id } } })
    await prisma.quoteItem.deleteMany({ where: { deal: { orgId: existing.id } } })
    await prisma.quote.deleteMany({ where: { deal: { orgId: existing.id } } })
    await prisma.deal.deleteMany({ where: { orgId: existing.id } })
    await prisma.client.deleteMany({ where: { orgId: existing.id } })
    await prisma.product.deleteMany({ where: { orgId: existing.id } })
    await prisma.orgSettings.deleteMany({ where: { orgId: existing.id } })
    await prisma.user.deleteMany({ where: { orgId: existing.id } })
    await prisma.organization.delete({ where: { id: existing.id } })
    console.log('  ✓ Removed previous demo org')
  }

  // Create org
  const org = await prisma.organization.create({
    data: {
      nazev: 'Demo firma — Klimatizace Novák',
      slug: 'demo',
      email: 'info@klimatizace-novak.cz',
      telefon: '+420 777 123 456',
      ico: '12345678',
      sidlo: 'Klimatická 42, 110 00 Praha 1',
      plan: 'PROFESSIONAL',
      aktivni: true,
      onboardingDone: true,
    },
  })

  // Create demo user (no real password — auth bypass)
  const demoHash = await bcrypt.hash('demo-placeholder-never-used', 10)
  const user = await prisma.user.create({
    data: {
      orgId: org.id,
      jmeno: 'Demo uživatel',
      email: 'demo@felucia.io',
      hesloHash: demoHash,
      role: 'ADMIN',
      aktivni: true,
    },
  })

  // OrgSettings
  await prisma.orgSettings.create({
    data: {
      orgId: org.id,
      modulServis: true,
      modulAnalytiky: true,
      modulDokumenty: true,
      modulDasa: true,
      modulCeniky: false,
      defaultDphSazba: 12,
      defaultPlatnostDni: 30,
      primaryColor: '#00D4C8',
    },
  })

  // Products
  const products = await prisma.product.createMany({
    data: [
      { orgId: org.id, kod: 'MXZ-3E68VA', nazev: 'Mitsubishi MXZ-3E68VA Multi-split', jednotka: 'ks', standardniCena: 38500, nakladovaCena: 29000, dphSazba: 12 },
      { orgId: org.id, kod: 'MSZ-AP35VG', nazev: 'Mitsubishi MSZ-AP35VG nástěnná j.', jednotka: 'ks', standardniCena: 14900, nakladovaCena: 11200, dphSazba: 12 },
      { orgId: org.id, kod: 'MONTAZ-KLIMA', nazev: 'Montáž klimatizace (standard)', jednotka: 'hod', standardniCena: 1200, nakladovaCena: 650, dphSazba: 21 },
      { orgId: org.id, kod: 'DAIKIN-FTXM35R', nazev: 'Daikin FTXM35R Perfera nástěnná', jednotka: 'ks', standardniCena: 16800, nakladovaCena: 12500, dphSazba: 12 },
      { orgId: org.id, kod: 'TC-AQC12', nazev: 'Tepelné čerpadlo AQUA 12 kW', jednotka: 'ks', standardniCena: 189000, nakladovaCena: 145000, dphSazba: 12 },
      { orgId: org.id, kod: 'REVIZE', nazev: 'Revize a servisní prohlídka', jednotka: 'ks', standardniCena: 2800, nakladovaCena: 900, dphSazba: 21 },
      { orgId: org.id, kod: 'CHLADIVO', nazev: 'Chladivo R32 (doplnění)', jednotka: 'kg', standardniCena: 380, nakladovaCena: 210, dphSazba: 21 },
    ],
  })

  // Clients
  const c1 = await prisma.client.create({ data: { orgId: org.id, typKlienta: TypKlienta.FYZICKA_OSOBA, jmeno: 'Martin', prijmeni: 'Svoboda', telefon: '+420 603 111 222', email: 'svoboda@email.cz', mesto: 'Praha', psc: '14000' } })
  const c2 = await prisma.client.create({ data: { orgId: org.id, typKlienta: TypKlienta.FIRMA, jmeno: 'TechCenter', prijmeni: 's.r.o.', telefon: '+420 221 445 566', email: 'info@techcenter.cz', ico: '45678901', mesto: 'Brno', psc: '60200' } })
  const c3 = await prisma.client.create({ data: { orgId: org.id, typKlienta: TypKlienta.FYZICKA_OSOBA, jmeno: 'Jana', prijmeni: 'Procházková', telefon: '+420 777 888 999', email: 'jana.prochazka@gmail.com', mesto: 'Plzeň', psc: '30100' } })
  const c4 = await prisma.client.create({ data: { orgId: org.id, typKlienta: TypKlienta.FIRMA, jmeno: 'Hotel Aurora', prijmeni: 'a.s.', telefon: '+420 381 234 567', email: 'technik@hotelaura.cz', ico: '67890123', mesto: 'České Budějovice', psc: '37001' } })
  const c5 = await prisma.client.create({ data: { orgId: org.id, typKlienta: TypKlienta.FYZICKA_OSOBA, jmeno: 'Tomáš', prijmeni: 'Kratochvíl', telefon: '+420 601 987 654', email: 'kratochvil.t@seznam.cz', mesto: 'Ostrava', psc: '70200' } })

  const now = new Date()

  // Deals
  const d1 = await prisma.deal.create({
    data: {
      orgId: org.id, clientId: c1.id, userId: user.id,
      technologie: Technologie.KLIMA, stav: StavDealu.NABIDKA,
      predmet: 'Klimatizace rodinný dům 4+kk',
      terminRealizace: new Date(now.getTime() + 21 * 86400000),
      dphSazba: 12,
      poznamky: 'Zákazník chce Mitsubishi, má zkušenosti s Daikiném',
    },
  })

  const d2 = await prisma.deal.create({
    data: {
      orgId: org.id, clientId: c2.id, userId: user.id,
      technologie: Technologie.KLIMA, stav: StavDealu.PRED_UZAVRENIM,
      predmet: 'Klimatizace kancelářský komplex',
      terminRealizace: new Date(now.getTime() + 35 * 86400000),
      dphSazba: 21,
      poznamky: 'VRF systém pro 3 patra, 18 vnitřních jednotek',
    },
  })

  const d3 = await prisma.deal.create({
    data: {
      orgId: org.id, clientId: c3.id, userId: user.id,
      technologie: Technologie.TEPELNE_CERPADLO, stav: StavDealu.JEDNANI,
      predmet: 'Tepelné čerpadlo vzduch-voda 12 kW',
      terminRealizace: new Date(now.getTime() + 45 * 86400000),
      dphSazba: 12,
    },
  })

  const d4 = await prisma.deal.create({
    data: {
      orgId: org.id, clientId: c4.id, userId: user.id,
      technologie: Technologie.KLIMA, stav: StavDealu.USPECH,
      predmet: 'Klimatizace hotelové pokoje (32 ks)',
      terminRealizace: new Date(now.getTime() - 15 * 86400000),
      dphSazba: 21,
      poznamky: 'Realizace dokončena, faktura odeslána',
    },
  })

  const d5 = await prisma.deal.create({
    data: {
      orgId: org.id, clientId: c5.id, userId: user.id,
      technologie: Technologie.REKUPERACE, stav: StavDealu.NOVY,
      predmet: 'Rekuperace novostavba 5+1',
      terminRealizace: new Date(now.getTime() + 60 * 86400000),
      dphSazba: 12,
    },
  })

  // Activities
  await prisma.activity.createMany({
    data: [
      { dealId: d1.id, userId: user.id, typ: TypAktivity.HOVOR, popis: 'Úvodní schůzka, zákazník potvrdil zájem o Mitsubishi', datum: new Date(now.getTime() - 3 * 86400000), splneno: true },
      { dealId: d1.id, userId: user.id, typ: TypAktivity.EMAIL, popis: 'Odeslána cenová nabídka NAB-26-001 (78 400 Kč)', datum: new Date(now.getTime() - 1 * 86400000), splneno: true },
      { dealId: d1.id, userId: user.id, typ: TypAktivity.UKOL, popis: 'Sledovat vyjádření do 3 pracovních dní', datum: new Date(now.getTime() + 3 * 86400000), splneno: false },
      { dealId: d2.id, userId: user.id, typ: TypAktivity.SCHUZKA, popis: 'Technická obhlídka objektu, 3 patra, naměřeno', datum: new Date(now.getTime() - 7 * 86400000), splneno: true },
      { dealId: d2.id, userId: user.id, typ: TypAktivity.EMAIL, popis: 'Zaslán projektový návrh VRF systému', datum: new Date(now.getTime() - 2 * 86400000), splneno: true },
      { dealId: d3.id, userId: user.id, typ: TypAktivity.HOVOR, popis: 'Zákazník se ptá na dotační program Nová zelená úsporám', datum: new Date(now.getTime() - 5 * 86400000), splneno: true },
      { dealId: d4.id, userId: user.id, typ: TypAktivity.POZNAMKA, popis: 'Realizace proběhla bez komplikací, zákazník spokojen', datum: new Date(now.getTime() - 15 * 86400000), splneno: true },
      { dealId: d5.id, userId: user.id, typ: TypAktivity.UKOL, popis: 'Připravit cenovou nabídku rekuperace', datum: new Date(now.getTime() + 2 * 86400000), splneno: false },
    ],
  })

  // Quote for d1
  const q1 = await prisma.quote.create({
    data: {
      dealId: d1.id, orgId: org.id,
      kod: 'NAB-26-001', nazev: 'Nabídka — klimatizace RD Svoboda',
      dphSazba: 12, aktivni: true,
    },
  })

  const allProducts = await prisma.product.findMany({ where: { orgId: org.id } })
  const findProd = (kod: string) => allProducts.find(p => p.kod === kod)!

  await prisma.quoteItem.createMany({
    data: [
      { dealId: d1.id, quoteId: q1.id, productId: findProd('MXZ-3E68VA').id, nazev: 'Mitsubishi MXZ-3E68VA Multi-split', mnozstvi: 1, jednotka: 'ks', cenaZaKus: 38500, nakupniCena: 29000, dphSazba: 12, poradi: 1 },
      { dealId: d1.id, quoteId: q1.id, productId: findProd('MSZ-AP35VG').id, nazev: 'Mitsubishi MSZ-AP35VG nástěnná j.', mnozstvi: 3, jednotka: 'ks', cenaZaKus: 14900, nakupniCena: 11200, dphSazba: 12, poradi: 2 },
      { dealId: d1.id, quoteId: q1.id, productId: findProd('MONTAZ-KLIMA').id, nazev: 'Montáž klimatizace (standard)', mnozstvi: 8, jednotka: 'hod', cenaZaKus: 1200, nakupniCena: 650, dphSazba: 21, poradi: 3 },
    ],
  })

  console.log('  ✓ Organization:', org.nazev)
  console.log('  ✓ User: demo@felucia.io')
  console.log('  ✓ Clients:', 5)
  console.log('  ✓ Deals:', 5)
  console.log(`  ✓ Products: ${allProducts.length}`)
  console.log('  ✓ Activities: 8')
  console.log('  ✓ Quote: NAB-26-001')
  console.log('\n✅ Demo seed complete!')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
