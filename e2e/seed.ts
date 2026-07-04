import { PrismaClient, Role } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

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

  console.log(JSON.stringify({ orgId: org.id, adminId: admin.id, clientId: client.id, zakazkaId: zakazka.id, servisniId: servisni.id }))
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
