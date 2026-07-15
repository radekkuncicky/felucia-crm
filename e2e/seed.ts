import { PrismaClient, Role } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'
import { E2E_PODPIS_ORG_SLUG, E2E_PODPIS_TOKEN, E2E_PODPIS_OTP, sha256, otpHash } from './podpis-fixture'

const url = process.env.DATABASE_URL!
if (!/nanto_crm_test/.test(url)) {
  throw new Error('e2e/seed: odmítám běžet mimo nanto_crm_test')
}

const adapter = new PrismaPg({ connectionString: url })
const prisma = new PrismaClient({ adapter })

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: 'e2e-org' },
    update: { plan: 'PROFESSIONAL', planActiveTo: new Date('2099-12-31'), aktivni: true },
    create: {
      nazev: 'E2E Test s.r.o.',
      slug: 'e2e-org',
      email: 'e2e@felucia.io',
      aktivni: true,
      plan: 'PROFESSIONAL',
      planActiveTo: new Date('2099-12-31'),
    },
  })

  const hash = await bcrypt.hash('e2e-Heslo-123', 12)
  const admin = await prisma.user.upsert({
    where: { orgId_email: { orgId: org.id, email: 'e2e-admin@felucia.io' } },
    update: { hesloHash: hash, aktivni: true, role: Role.ADMIN },
    create: {
      orgId: org.id,
      jmeno: 'E2E Admin',
      email: 'e2e-admin@felucia.io',
      hesloHash: hash,
      role: Role.ADMIN,
    },
  })

  const client = await prisma.client.findFirst({ where: { orgId: org.id, prijmeni: 'E2E' } })
    ?? await prisma.client.create({
      data: { orgId: org.id, jmeno: 'Klient', prijmeni: 'E2E', email: 'klient@example.com', telefon: '+420111222333' },
    })

  let zakazka = await prisma.zakazka.findFirst({ where: { orgId: org.id, nazev: 'E2E Zakázka' } })
  if (!zakazka) {
    zakazka = await prisma.zakazka.create({
      data: {
        orgId: org.id,
        cislo: 'Z-E2E-0001',
        nazev: 'E2E Zakázka',
        klientId: client.id,
      },
    })
  }

  let servisni = await prisma.servisniZakazka.findFirst({ where: { orgId: org.id, poznamka: 'E2E servisní zakázka' } })
  if (!servisni) {
    const rok = String(new Date().getFullYear()).slice(2)
    servisni = await prisma.servisniZakazka.create({
      data: {
        orgId: org.id,
        cislo: `SZ-${rok}-9001`,
        typ: 'PORUCHA',
        stav: 'NOVA',
        poznamka: 'E2E servisní zakázka',
        klientId: client.id,
      },
    })
  }

  // Fixture pro e2e/podpis.spec.ts (QR nudge „podepiš na mobilu") — vlastní
  // org, aby test na SOD stavu nezávisel na ničem jiném. Vždy přepsat do
  // čistého stavu, ať e2e.sh jde spustit opakovaně.
  const qrOrg = await prisma.organization.upsert({
    where: { slug: E2E_PODPIS_ORG_SLUG },
    update: { plan: 'PROFESSIONAL', aktivni: true },
    create: { nazev: 'QR Nudge s.r.o.', slug: E2E_PODPIS_ORG_SLUG, plan: 'PROFESSIONAL', aktivni: true },
  })
  const qrClient = await prisma.client.findFirst({ where: { orgId: qrOrg.id, prijmeni: 'Klient' } })
    ?? await prisma.client.create({ data: { orgId: qrOrg.id, jmeno: 'Karel', prijmeni: 'Klient' } })
  const qrDeal = await prisma.deal.findFirst({ where: { orgId: qrOrg.id, kod: 'QR-NUDGE-OP' } })
    ?? await prisma.deal.create({
      data: { orgId: qrOrg.id, clientId: qrClient.id, predmet: 'TČ', kod: 'QR-NUDGE-OP', technologie: 'TEPELNE_CERPADLO' },
    })
  const qrSod = await prisma.sod.upsert({
    where: { orgId_cislo: { orgId: qrOrg.id, cislo: 'SOD-QR-NUDGE' } },
    update: { stav: 'ODESLANO' },
    create: {
      orgId: qrOrg.id, dealId: qrDeal.id, cislo: 'SOD-QR-NUDGE', typ: 'DPH_12_BEZ_ZALOHY',
      klientJmeno: 'Karel Klient', predmetDila: 'Tepelné čerpadlo', stav: 'ODESLANO',
    },
  })
  const qrVerze = await prisma.sodVerze.findFirst({ where: { sodId: qrSod.id }, orderBy: { cislo: 'desc' } })
    ?? await prisma.sodVerze.create({
      data: { orgId: qrOrg.id, sodId: qrSod.id, cislo: 1, textSmlouvy: '<html><body><p>Text smlouvy</p></body></html>' },
    })
  const qrRelace = await prisma.sodPodpisRelace.upsert({
    where: { tokenHash: sha256(E2E_PODPIS_TOKEN) },
    update: { stav: 'AKTIVNI', verzeId: qrVerze.id, expirace: new Date(Date.now() + 365 * 24 * 3600_000) },
    create: {
      orgId: qrOrg.id, sodId: qrSod.id, verzeId: qrVerze.id,
      tokenHash: sha256(E2E_PODPIS_TOKEN),
      email: 'karel@example.com', telefon: '420777123456',
      expirace: new Date(Date.now() + 365 * 24 * 3600_000),
    },
  })
  // OTP napevno předpočítaný (relaceId je stabilní po prvním vytvoření) —
  // spec soubor tak může ověřit kód bez volání /otp (to by v env se
  // živými SMS credentials poslalo skutečnou SMS).
  await prisma.sodPodpisRelace.update({
    where: { id: qrRelace.id },
    data: {
      otpHash: otpHash(E2E_PODPIS_OTP, qrRelace.id),
      otpExpirace: new Date(Date.now() + 365 * 24 * 3600_000),
      otpPokusy: 0,
      otpOvereno: null,
    },
  })

  console.log(JSON.stringify({ orgId: org.id, adminId: admin.id, clientId: client.id, zakazkaId: zakazka.id, servisniId: servisni.id }))
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
