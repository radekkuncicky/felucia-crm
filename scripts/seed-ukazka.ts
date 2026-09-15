/**
 * Seed testovací firmy pro Apple App Review (felucia-tech / TestFlight).
 * Vytváří org "applereview" + ADMIN + TECHNIK účet + pár servisních zakázek,
 * ať appka při review není prázdná.
 *
 * Hesla se berou z .env (SEED_ADMIN_PASSWORD, SEED_TECHNIK_PASSWORD), ať
 * nejsou v gitu — jsou to reálné přihlašovací údaje, které dostává App Review.
 *
 * Run: npx tsx scripts/seed-apple-review.ts
 */

import { PrismaClient, ZakazkaStav, ZakazkaPolozkaStav } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const SLUG = 'applereview'
const ADMIN_EMAIL = 'admin.applereview@felucia.io'
const TECHNIK_EMAIL = 'technik.demo@felucia.io'

function requireEnv(name: string) {
  const val = process.env[name]
  if (!val) {
    console.error(`✗ Chybí ${name} v .env — bez něj by seed nastavil neznámé heslo.`)
    process.exit(1)
  }
  return val
}

const ADMIN_PASSWORD = requireEnv('SEED_ADMIN_PASSWORD')
const TECHNIK_PASSWORD = requireEnv('SEED_TECHNIK_PASSWORD')

async function main() {
  console.log('🌱 Seeding Apple review org...')

  const existing = await prisma.organization.findFirst({ where: { slug: SLUG } })
  if (existing) {
    await prisma.zakazkaKomentar.deleteMany({ where: { zakazka: { orgId: existing.id } } })
    await prisma.zakazkaFoto.deleteMany({ where: { zakazka: { orgId: existing.id } } })
    await prisma.zakazkaPolozka.deleteMany({ where: { zakazka: { orgId: existing.id } } })
    await prisma.technikZakazka.deleteMany({ where: { zakazka: { orgId: existing.id } } })
    await prisma.zakazka.deleteMany({ where: { orgId: existing.id } })
    await prisma.client.deleteMany({ where: { orgId: existing.id } })
    await prisma.orgSettings.deleteMany({ where: { orgId: existing.id } })
    await prisma.user.deleteMany({ where: { orgId: existing.id } })
    await prisma.organization.delete({ where: { id: existing.id } })
    console.log('  ✓ Removed previous applereview org')
  }

  const org = await prisma.organization.create({
    data: {
      nazev: 'Klima Servis Ukázka s.r.o.',
      slug: SLUG,
      email: 'info@klimaservis-ukazka.cz',
      telefon: '+420 777 000 111',
      ico: '99999999',
      sidlo: 'Testovací 1, 100 00 Praha 10',
      plan: 'PROFESSIONAL',
      aktivni: true,
      onboardingDone: true,
    },
  })

  await prisma.orgSettings.create({
    data: {
      orgId: org.id,
      modulServis: true,
      modulDokumenty: true,
      modulAnalytiky: true,
      primaryColor: '#00D4C8',
    },
  })

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12)
  const admin = await prisma.user.create({
    data: {
      orgId: org.id,
      jmeno: 'Admin (Apple review)',
      email: ADMIN_EMAIL,
      hesloHash: adminHash,
      role: 'ADMIN',
      aktivni: true,
    },
  })

  const technikHash = await bcrypt.hash(TECHNIK_PASSWORD, 12)
  const technik = await prisma.user.create({
    data: {
      orgId: org.id,
      jmeno: 'Technik Demo',
      email: TECHNIK_EMAIL,
      hesloHash: technikHash,
      role: 'TECHNIK',
      aktivni: true,
    },
  })

  const c1 = await prisma.client.create({
    data: { orgId: org.id, typKlienta: 'FYZICKA_OSOBA', jmeno: 'Petr', prijmeni: 'Horák', telefon: '+420 606 111 222', email: 'horak@email.cz', mesto: 'Praha', psc: '10000', ulice: 'Vinohradská 55' },
  })
  const c2 = await prisma.client.create({
    data: { orgId: org.id, typKlienta: 'FIRMA', jmeno: 'Penzion U Lípy', prijmeni: 's.r.o.', telefon: '+420 602 333 444', email: 'penzion@ulipy.cz', ico: '11223344', mesto: 'Kutná Hora', psc: '28401', ulice: 'Husova 12' },
  })
  const c3 = await prisma.client.create({
    data: { orgId: org.id, typKlienta: 'FYZICKA_OSOBA', jmeno: 'Eva', prijmeni: 'Nováková', telefon: '+420 776 555 666', email: 'e.novakova@seznam.cz', mesto: 'Kolín', psc: '28002', ulice: 'Kmochova 8' },
  })

  const now = new Date()
  const today8 = new Date(now); today8.setHours(8, 0, 0, 0)
  const today16 = new Date(now); today16.setHours(16, 0, 0, 0)
  const tomorrow9 = new Date(now.getTime() + 86400000); tomorrow9.setHours(9, 0, 0, 0)
  const tomorrow13 = new Date(now.getTime() + 86400000); tomorrow13.setHours(13, 0, 0, 0)
  const lastWeek = new Date(now.getTime() - 7 * 86400000)

  const z1 = await prisma.zakazka.create({
    data: {
      orgId: org.id, cislo: '26-901', klientId: c1.id, vedouciId: admin.id,
      nazev: 'Montáž klimatizace — byt 3+kk', technologie: 'KLIMA',
      stav: ZakazkaStav.V_REALIZACI,
      mistoStavby: 'Vinohradská 55, 100 00 Praha 10',
      montazOd: today8, montazDo: today16,
      pokyny: 'Zvonek "Horák", klíče od výtahu u sousedů ve 2. patře.',
    },
  })
  await prisma.technikZakazka.create({ data: { zakazkaId: z1.id, technikId: technik.id } })
  await prisma.zakazkaPolozka.createMany({
    data: [
      { zakazkaId: z1.id, nazev: 'Vnitřní jednotka Mitsubishi MSZ-AP35VG', mnozstvi: 1, jednotka: 'ks', stav: ZakazkaPolozkaStav.VYDANO, hotovo: true, poradi: 1 },
      { zakazkaId: z1.id, nazev: 'Venkovní jednotka Mitsubishi MUZ-AP35VG', mnozstvi: 1, jednotka: 'ks', stav: ZakazkaPolozkaStav.VYDANO, hotovo: true, poradi: 2 },
      { zakazkaId: z1.id, nazev: 'Instalace potrubí a propojení', mnozstvi: 1, jednotka: 'ks', stav: ZakazkaPolozkaStav.NASKLADNENO, hotovo: false, poradi: 3 },
      { zakazkaId: z1.id, nazev: 'Zkušební provoz a předání', mnozstvi: 1, jednotka: 'ks', stav: ZakazkaPolozkaStav.CEKA, hotovo: false, poradi: 4 },
    ],
  })
  await prisma.zakazkaKomentar.createMany({
    data: [
      { zakazkaId: z1.id, userId: admin.id, text: 'Zákazník bude doma od 8:00, má i psa, prosím zazvonit dvakrát.' },
      { zakazkaId: z1.id, userId: technik.id, text: 'Dorazil jsem, vnitřní i venkovní jednotka namontovány, pokračuji propojením.' },
    ],
  })

  const z2 = await prisma.zakazka.create({
    data: {
      orgId: org.id, cislo: '26-902', klientId: c2.id, vedouciId: admin.id,
      nazev: 'Servisní prohlídka VRF systému', technologie: 'KLIMA',
      stav: ZakazkaStav.PRIRAZENA,
      mistoStavby: 'Husova 12, 284 01 Kutná Hora',
      montazOd: tomorrow9, montazDo: tomorrow13,
      pokyny: 'Kontaktovat recepci penzionu, systém je ve strojovně v suterénu.',
    },
  })
  await prisma.technikZakazka.create({ data: { zakazkaId: z2.id, technikId: technik.id } })
  await prisma.zakazkaPolozka.createMany({
    data: [
      { zakazkaId: z2.id, nazev: 'Kontrola tlaku chladiva', mnozstvi: 1, jednotka: 'ks', stav: ZakazkaPolozkaStav.CEKA, hotovo: false, poradi: 1 },
      { zakazkaId: z2.id, nazev: 'Čištění filtrů (12 ks jednotek)', mnozstvi: 12, jednotka: 'ks', stav: ZakazkaPolozkaStav.CEKA, hotovo: false, poradi: 2 },
      { zakazkaId: z2.id, nazev: 'Revizní zpráva', mnozstvi: 1, jednotka: 'ks', stav: ZakazkaPolozkaStav.CEKA, hotovo: false, poradi: 3 },
    ],
  })

  const z3 = await prisma.zakazka.create({
    data: {
      orgId: org.id, cislo: '26-903', klientId: c3.id, vedouciId: admin.id,
      nazev: 'Montáž tepelného čerpadla vzduch-voda', technologie: 'TEPELNE_CERPADLO',
      stav: ZakazkaStav.PREDANA,
      mistoStavby: 'Kmochova 8, 280 02 Kolín',
      montazOd: lastWeek, montazDo: lastWeek,
      poznamka: 'Realizace proběhla bez komplikací, protokol podepsán klientem.',
    },
  })
  await prisma.technikZakazka.create({ data: { zakazkaId: z3.id, technikId: technik.id } })
  await prisma.zakazkaPolozka.createMany({
    data: [
      { zakazkaId: z3.id, nazev: 'Tepelné čerpadlo AQUA 12 kW', mnozstvi: 1, jednotka: 'ks', stav: ZakazkaPolozkaStav.VYDANO, hotovo: true, poradi: 1 },
      { zakazkaId: z3.id, nazev: 'Montáž a zapojení', mnozstvi: 1, jednotka: 'ks', stav: ZakazkaPolozkaStav.VYDANO, hotovo: true, poradi: 2 },
    ],
  })
  await prisma.zakazkaKomentar.create({
    data: { zakazkaId: z3.id, userId: technik.id, text: 'Předáno, zákazník spokojen, protokol nahrán.' },
  })

  console.log('  ✓ Organization:', org.nazev, `(slug: ${org.slug})`)
  console.log('  ✓ Admin:', ADMIN_EMAIL)
  console.log('  ✓ Technik:', TECHNIK_EMAIL)
  console.log('  ✓ Zakázky: 26-901 (dnes), 26-902 (zítra), 26-903 (minulá)')
  console.log('\n✅ Apple review seed complete!')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
