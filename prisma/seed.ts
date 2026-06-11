import { PrismaClient, Role, Technologie, StavDealu, TypAktivity } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  // Create organization
  const org = await prisma.organization.upsert({
    where: { slug: 'felucia' },
    update: {
      plan: 'PROFESSIONAL',
      planActiveTo: new Date('2099-12-31'),
    },
    create: {
      nazev: 'FELUCIA s.r.o.',
      slug: 'felucia',
      email: 'info@felucia.io',
      telefon: '+420 123 456 789',
      aktivni: true,
      plan: 'PROFESSIONAL',
      planActiveTo: new Date('2099-12-31'),
    },
  })

  console.log('Organization created:', org.nazev)

  // Create admin user
  const adminHash = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { orgId_email: { orgId: org.id, email: 'admin@felucia.io' } },
    update: {},
    create: {
      orgId: org.id,
      jmeno: 'Admin Felucia',
      email: 'admin@felucia.io',
      hesloHash: adminHash,
      role: Role.ADMIN,
    },
  })

  // Create obchodnik user
  const obchodnikHash = await bcrypt.hash('obchodnik123', 12)
  const obchodnik = await prisma.user.upsert({
    where: { orgId_email: { orgId: org.id, email: 'novak@felucia.io' } },
    update: {},
    create: {
      orgId: org.id,
      jmeno: 'Petr Novák',
      email: 'novak@felucia.io',
      hesloHash: obchodnikHash,
      role: Role.OBCHODNIK,
    },
  })

  console.log('Users created:', admin.email, obchodnik.email)

  // Create products
  const products = await Promise.all([
    prisma.product.upsert({
      where: { id: 'prod-klima-1' },
      update: {},
      create: {
        id: 'prod-klima-1',
        orgId: org.id,
        nazev: 'Daikin Perfera 2,5kW - nástěnná jednotka',
        standardniCena: 28900,
        jednotka: 'ks',
        aktivni: true,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-klima-2' },
      update: {},
      create: {
        id: 'prod-klima-2',
        orgId: org.id,
        nazev: 'Daikin Perfera 3,5kW - nástěnná jednotka',
        standardniCena: 32900,
        jednotka: 'ks',
        aktivni: true,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-klima-3' },
      update: {},
      create: {
        id: 'prod-klima-3',
        orgId: org.id,
        nazev: 'Mitsubishi Electric MSZ-HR25VF 2,5kW',
        standardniCena: 26500,
        jednotka: 'ks',
        aktivni: true,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-tc-1' },
      update: {},
      create: {
        id: 'prod-tc-1',
        orgId: org.id,
        nazev: 'Daikin Altherma 3 R 8kW - tepelné čerpadlo',
        standardniCena: 189000,
        jednotka: 'ks',
        aktivni: true,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-tc-2' },
      update: {},
      create: {
        id: 'prod-tc-2',
        orgId: org.id,
        nazev: 'Vaillant aroTHERM plus 10kW - tepelné čerpadlo',
        standardniCena: 215000,
        jednotka: 'ks',
        aktivni: true,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-tc-3' },
      update: {},
      create: {
        id: 'prod-tc-3',
        orgId: org.id,
        nazev: 'Buderus Logatherm WLW196i 12kW - tepelné čerpadlo',
        standardniCena: 235000,
        jednotka: 'ks',
        aktivni: true,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-rek-1' },
      update: {},
      create: {
        id: 'prod-rek-1',
        orgId: org.id,
        nazev: 'Zehnder ComfoAir Q350 - rekuperační jednotka',
        standardniCena: 65000,
        jednotka: 'ks',
        aktivni: true,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-mont-1' },
      update: {},
      create: {
        id: 'prod-mont-1',
        orgId: org.id,
        nazev: 'Montáž klimatizace - split systém',
        standardniCena: 8500,
        jednotka: 'ks',
        aktivni: true,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-mont-2' },
      update: {},
      create: {
        id: 'prod-mont-2',
        orgId: org.id,
        nazev: 'Montáž tepelného čerpadla',
        standardniCena: 35000,
        jednotka: 'ks',
        aktivni: true,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-servis-1' },
      update: {},
      create: {
        id: 'prod-servis-1',
        orgId: org.id,
        nazev: 'Servisní prohlídka klimatizace',
        standardniCena: 2500,
        jednotka: 'hod',
        aktivni: true,
      },
    }),
  ])

  console.log('Products created:', products.length)

  // Create sample clients
  const client1 = await prisma.client.create({
    data: {
      orgId: org.id,
      jmeno: 'Jan',
      prijmeni: 'Svoboda',
      telefon: '+420 777 111 222',
      email: 'svoboda@email.cz',
    },
  })

  const client2 = await prisma.client.create({
    data: {
      orgId: org.id,
      jmeno: 'Marie',
      prijmeni: 'Horáčková',
      telefon: '+420 603 333 444',
      email: 'horac@seznam.cz',
    },
  })

  const client3 = await prisma.client.create({
    data: {
      orgId: org.id,
      jmeno: 'Tomáš',
      prijmeni: 'Blažek',
      telefon: '+420 721 555 666',
      email: 'blazek.t@firma.cz',
    },
  })

  console.log('Clients created:', client1.prijmeni, client2.prijmeni, client3.prijmeni)

  // Create sample deals
  const deal1 = await prisma.deal.create({
    data: {
      orgId: org.id,
      clientId: client1.id,
      userId: obchodnik.id,
      technologie: Technologie.KLIMA,
      stav: StavDealu.NABIDKA,
      predmet: 'Klimatizace rodinný dům - 3 místnosti',
      hodnotaZalohy: 25000,
      splatnostZalohy: new Date('2026-04-01'),
      terminRealizace: new Date('2026-05-15'),
      adresaDila: 'Zahradní 15, 602 00 Brno',
      kontaktniOsoba: 'Jan Svoboda',
      kontaktniTelefon: '+420 777 111 222',
      quoteItems: {
        create: [
          {
            productId: 'prod-klima-1',
            nazev: 'Daikin Perfera 2,5kW - nástěnná jednotka',
            mnozstvi: 2,
            cenaZaKus: 28900,
          },
          {
            productId: 'prod-klima-2',
            nazev: 'Daikin Perfera 3,5kW - nástěnná jednotka',
            mnozstvi: 1,
            cenaZaKus: 32900,
          },
          {
            productId: 'prod-mont-1',
            nazev: 'Montáž klimatizace - split systém',
            mnozstvi: 3,
            cenaZaKus: 8500,
          },
        ],
      },
    },
  })

  const deal2 = await prisma.deal.create({
    data: {
      orgId: org.id,
      clientId: client2.id,
      userId: obchodnik.id,
      technologie: Technologie.TEPELNE_CERPADLO,
      stav: StavDealu.JEDNANI,
      predmet: 'Tepelné čerpadlo - novostavba RD',
      terminRealizace: new Date('2026-06-30'),
      adresaDila: 'Nová 8, 664 61 Rajhrad',
      kontaktniOsoba: 'Marie Horáčková',
      kontaktniTelefon: '+420 603 333 444',
    },
  })

  const deal3 = await prisma.deal.create({
    data: {
      orgId: org.id,
      clientId: client3.id,
      userId: admin.id,
      technologie: Technologie.REKUPERACE,
      stav: StavDealu.USPECH,
      predmet: 'Rekuperace - administrativní budova',
      hodnotaZalohy: 30000,
      cisloSmlouvy: 'SML-2026-001',
      terminPrevzeti: new Date('2026-02-28'),
      terminRealizace: new Date('2026-02-20'),
      adresaDila: 'Průmyslová 42, 628 00 Brno',
      kontaktniOsoba: 'Tomáš Blažek',
      kontaktniTelefon: '+420 721 555 666',
    },
  })

  console.log('Deals created:', deal1.predmet, deal2.predmet, deal3.predmet)

  // Create sample activities
  await prisma.activity.createMany({
    data: [
      {
        dealId: deal1.id,
        userId: obchodnik.id,
        typ: TypAktivity.HOVOR,
        popis: 'Úvodní telefonát - zákazník má zájem o klimatizaci do 3 místností',
        datum: new Date('2026-03-10'),
      },
      {
        dealId: deal1.id,
        userId: obchodnik.id,
        typ: TypAktivity.SCHUZKA,
        popis: 'Prohlídka objektu - zaměření prostorů, doporučena Daikin Perfera',
        datum: new Date('2026-03-14'),
      },
      {
        dealId: deal2.id,
        userId: obchodnik.id,
        typ: TypAktivity.EMAIL,
        popis: 'Zaslána informační nabídka tepelných čerpadel Daikin a Vaillant',
        datum: new Date('2026-03-12'),
      },
      {
        dealId: deal3.id,
        userId: admin.id,
        typ: TypAktivity.POZNAMKA,
        popis: 'Projekt úspěšně dokončen, zákazník spokojen. Předávací protokol podepsán.',
        datum: new Date('2026-02-28'),
      },
    ],
  })

  console.log('Activities created')

  // Create sample quote templates
  await prisma.quoteTemplate.upsert({
    where: { id: 'tpl-klima-1' },
    update: {},
    create: {
      id: 'tpl-klima-1',
      orgId: org.id,
      nazev: 'Klimatizace RD — 3 místnosti (Daikin)',
      popis: 'Standardní sada pro rodinný dům, 3 nástěnné jednotky Daikin + montáž',
      technologie: Technologie.KLIMA,
      polozky: [
        { product_id: 'prod-klima-1', nazev: 'Daikin Perfera 2,5kW - nástěnná jednotka', mnozstvi: 2, cena_za_kus: 28900 },
        { product_id: 'prod-klima-2', nazev: 'Daikin Perfera 3,5kW - nástěnná jednotka', mnozstvi: 1, cena_za_kus: 32900 },
        { product_id: 'prod-mont-1', nazev: 'Montáž klimatizace - split systém', mnozstvi: 3, cena_za_kus: 8500 },
      ],
    },
  })

  await prisma.quoteTemplate.upsert({
    where: { id: 'tpl-klima-2' },
    update: {},
    create: {
      id: 'tpl-klima-2',
      orgId: org.id,
      nazev: 'Klimatizace byt 2+1 (Mitsubishi)',
      popis: 'Sada pro byt 2+1, 1 nástěnná jednotka Mitsubishi + montáž',
      technologie: Technologie.KLIMA,
      polozky: [
        { product_id: 'prod-klima-3', nazev: 'Mitsubishi Electric MSZ-HR25VF 2,5kW', mnozstvi: 1, cena_za_kus: 26500 },
        { product_id: 'prod-mont-1', nazev: 'Montáž klimatizace - split systém', mnozstvi: 1, cena_za_kus: 8500 },
        { nazev: 'Chladivo R32 - doplnění', mnozstvi: 1, cena_za_kus: 1500, poznamky: 'Dle potřeby' },
      ],
    },
  })

  await prisma.quoteTemplate.upsert({
    where: { id: 'tpl-tc-1' },
    update: {},
    create: {
      id: 'tpl-tc-1',
      orgId: org.id,
      nazev: 'Tepelné čerpadlo novostavba (Daikin 8kW)',
      popis: 'Kompletní sada pro novostavbu RD — tepelné čerpadlo + montáž',
      technologie: Technologie.TEPELNE_CERPADLO,
      polozky: [
        { product_id: 'prod-tc-1', nazev: 'Daikin Altherma 3 R 8kW - tepelné čerpadlo', mnozstvi: 1, cena_za_kus: 189000 },
        { product_id: 'prod-mont-2', nazev: 'Montáž tepelného čerpadla', mnozstvi: 1, cena_za_kus: 35000 },
        { nazev: 'Elektroinstalace a zapojení', mnozstvi: 1, cena_za_kus: 12000 },
      ],
    },
  })

  console.log('Quote templates created')

  // Contract templates
  await prisma.contractTemplate.upsert({
    where: { id: 'ctpl-klima-1' },
    update: {},
    create: {
      id: 'ctpl-klima-1',
      orgId: org.id,
      nazev: 'Smlouva o dílo – Klimatizace',
      obsah: `SMLOUVA O DÍLO

uzavřená dne {{datum}} dle § 2586 a násl. zákona č. 89/2012 Sb., občanský zákoník

ZHOTOVITEL:
{{organizace}}

OBJEDNATEL:
{{klient_jmeno}}
Tel: {{klient_telefon}}
E-mail: {{klient_email}}

Číslo smlouvy: {{cislo_smlouvy}}
Kód OP: {{kod_op}}

PŘEDMĚT SMLOUVY

1. Zhotovitel se zavazuje provést pro objednatele dílo: {{predmet}}

2. Místo provádění díla: {{adresa_dila}}

3. Kontaktní osoba: {{kontaktni_osoba}}, tel: {{kontaktni_telefon}}

CENA DÍLA

Smluvní cena díla bez DPH: {{konecna_cena}}
DPH ({{dph_sazba}}): součást ceny
Celková cena včetně DPH: {{cena_s_dph}}

Záloha: {{hodnota_zalohy}}

TERMÍN PLNĚNÍ

Termín realizace: {{termin_realizace}}

ZÁVĚREČNÁ USTANOVENÍ

Smlouva je vyhotovena ve dvou stejnopisech, z nichž každá strana obdrží jeden výtisk.

V ________________ dne {{datum}}

_________________________        _________________________
Zhotovitel                       Objednatel
{{organizace}}                   {{klient_jmeno}}`,
    },
  })

  await prisma.contractTemplate.upsert({
    where: { id: 'ctpl-tc-1' },
    update: {},
    create: {
      id: 'ctpl-tc-1',
      orgId: org.id,
      nazev: 'Smlouva o dílo – Tepelné čerpadlo',
      obsah: `SMLOUVA O DÍLO – TEPELNÉ ČERPADLO

uzavřená dne {{datum}} dle § 2586 a násl. zákona č. 89/2012 Sb., občanský zákoník

ZHOTOVITEL:
{{organizace}}

OBJEDNATEL:
{{klient_jmeno}}
Tel: {{klient_telefon}}
E-mail: {{klient_email}}

Číslo smlouvy: {{cislo_smlouvy}}
Kód OP: {{kod_op}}

PŘEDMĚT SMLOUVY

1. Zhotovitel se zavazuje provést pro objednatele dodávku a instalaci tepelného čerpadla: {{predmet}}

2. Místo provádění díla: {{adresa_dila}}

3. Kontaktní osoba objednatele: {{kontaktni_osoba}}, tel: {{kontaktni_telefon}}

4. Odpovědný obchodní zástupce zhotovitele: {{obchodnik}}

CENA DÍLA

Cena díla bez DPH: {{konecna_cena}}
Sazba DPH: {{dph_sazba}}
Celková cena včetně DPH: {{cena_s_dph}}

Záloha splatná dle podmínek: {{hodnota_zalohy}}

TERMÍN PLNĚNÍ

Předpokládaný termín realizace: {{termin_realizace}}

ZÁRUKA A SERVIS

Zhotovitel poskytuje záruční dobu 24 měsíců na provedené práce a instalované zařízení.

ZÁVĚREČNÁ USTANOVENÍ

Smlouva nabývá platnosti a účinnosti dnem podpisu obou smluvních stran.

V ________________ dne {{datum}}

_________________________        _________________________
Zhotovitel                       Objednatel
{{organizace}}                   {{klient_jmeno}}`,
    },
  })

  console.log('Contract templates created')
  console.log('\nSeed completed successfully!')
  console.log('\nLogin credentials:')
  console.log('  Admin:     admin@felucia.io / admin123')
  console.log('  Obchodník: novak@felucia.io / obchodnik123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
