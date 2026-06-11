import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'

config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const OPS = [
  { kod: 'OP-26-071', predmet: 'Reku - finalni reseni', klient: 'Martin Klega', ico: null, mesto: '', ulice: '', telefon: '725174941', email: 'klegamartin@seznam.cz', stav: 'PRED_UZAVRENIM', cenaBezDph: 269503, cenaSDph: 302253.76, naklady: 169542, technologie: 'REKUPERACE', otevreno: '2026-03-30', popis: '' },
  { kod: 'OP-26-070', predmet: 'Klimy', klient: 'Ing. Josef Hlavsa', ico: '01260219', mesto: 'Ostrava', ulice: 'Výhledy 566/38b', telefon: null, email: null, stav: 'ZAKAZKA', cenaBezDph: 190669, cenaSDph: 213549.28, naklady: 76623, technologie: 'KLIMA', otevreno: '2026-03-25', popis: '' },
  { kod: 'OP-26-068', predmet: 'Klima', klient: 'Adam Křiva', ico: '03508510', mesto: 'Baška', ulice: 'Kunčičky u Bašky 172', telefon: null, email: null, stav: 'ZAKAZKA', cenaBezDph: 42550, cenaSDph: 51485.5, naklady: 0, technologie: 'KLIMA', otevreno: '2026-03-24', popis: '' },
  { kod: 'OP-26-067', predmet: 'podlahovka', klient: 'Filip Veselý', ico: null, mesto: '', ulice: '', telefon: null, email: null, stav: 'ZAKAZKA', cenaBezDph: 201451, cenaSDph: 225625.12, naklady: 0, technologie: 'PODLAHOVE_VYTAPENI', otevreno: '2026-03-23', popis: '' },
  { kod: 'OP-26-066', predmet: 'TČ', klient: 'Filip Veselý', ico: null, mesto: '', ulice: '', telefon: null, email: null, stav: 'ZAKAZKA', cenaBezDph: 266135, cenaSDph: 298071.2, naklady: 198376, technologie: 'TEPELNE_CERPADLO', otevreno: '2026-03-23', popis: '' },
  { kod: 'OP-26-063', predmet: 'Dece', klient: 'Bc. Štěpán Neuwirth', ico: '74609262', mesto: 'Petrovice u Karviné', ulice: 'Dolní Marklovice 70', telefon: '722063848', email: 'xneuwirt@seznam.cz', stav: 'ZAKAZKA', cenaBezDph: 24694, cenaSDph: 27657.28, naklady: 0, technologie: 'REKUPERACE', otevreno: '2026-03-20', popis: '' },
  { kod: 'OP-26-062', predmet: 'Rekupka', klient: 'Ing. Jan Macháč', ico: null, mesto: '', ulice: '', telefon: null, email: null, stav: 'NABIDKA', cenaBezDph: 174260, cenaSDph: 195171.2, naklady: 0, technologie: 'REKUPERACE', otevreno: '2026-03-20', popis: '' },
  { kod: 'OP-26-061', predmet: 'Reku', klient: 'Ondřej Staňkovič', ico: null, mesto: '', ulice: '', telefon: '420735635217', email: 'o.stank@seznam.cz', stav: 'NABIDKA', cenaBezDph: 40369, cenaSDph: 45213.28, naklady: 30000, technologie: 'REKUPERACE', otevreno: '2026-03-20', popis: '' },
  { kod: 'OP-26-059', predmet: 'rekupka', klient: 'Madzia ml.', ico: null, mesto: '', ulice: '', telefon: null, email: null, stav: 'ZAKAZKA', cenaBezDph: 0, cenaSDph: 0, naklady: 0, technologie: 'REKUPERACE', otevreno: '2026-03-17', popis: '' },
  { kod: 'OP-26-056', predmet: 'Projekt', klient: 'TAW, s.r.o.', ico: '60318538', mesto: 'Ostrava', ulice: 'Suderova 2013/19a', telefon: '420 604 250 624', email: 'vrkocova@taw.cz', stav: 'NABIDKA', cenaBezDph: 16000, cenaSDph: 19360, naklady: 0, technologie: 'VZDUCHOTECHNIKA', otevreno: '2026-03-16', popis: '' },
  { kod: 'OP-26-053', predmet: 'Rekupka', klient: 'Jan Šimurda', ico: null, mesto: '', ulice: '', telefon: null, email: null, stav: 'ZAKAZKA', cenaBezDph: 152171, cenaSDph: 170431.52, naklady: 53010, technologie: 'REKUPERACE', otevreno: '2026-03-10', popis: 'vyresime az bude lepsi podstropka nebo nejaka akce' },
  { kod: 'OP-26-051', predmet: 'Podlahovka', klient: 'Petra Foltová', ico: null, mesto: '', ulice: '', telefon: '420732193167', email: 'foltova.petra@gmail.com', stav: 'NABIDKA', cenaBezDph: 175013, cenaSDph: 196014.56, naklady: 0, technologie: 'TEPELNE_CERPADLO', otevreno: '2026-03-04', popis: '' },
  { kod: 'OP-26-050', predmet: 'Strachotice 5 ks', klient: 'DEPRO-STAVBY A INVESTICE CZ a.s.', ico: '21258139', mesto: 'Praha', ulice: 'Těšnov 1163/5', telefon: '603993633', email: 'sarkakocurova@deprostav.cz', stav: 'KONTAKTOVAN', cenaBezDph: 80900, cenaSDph: 90608, naklady: 0, technologie: 'REKUPERACE', otevreno: '2026-03-04', popis: '' },
  { kod: 'OP-26-049', predmet: 'Decentrálky', klient: 'Jakub Kolář', ico: null, mesto: 'Kozmice u Hlučína', ulice: 'K Hájovně 412/2', telefon: '723955143', email: 'kolar14@post.cz', stav: 'NABIDKA', cenaBezDph: 41419, cenaSDph: 46389.28, naklady: 30000, technologie: 'REKUPERACE', otevreno: '2026-03-03', popis: '' },
  { kod: 'OP-26-045', predmet: 'Rekuperace', klient: 'Vladan Mohelník', ico: null, mesto: '', ulice: '', telefon: '420 773 772 844', email: 'V.Mohelnik@seznam.cz', stav: 'NABIDKA', cenaBezDph: 202540, cenaSDph: 226844.8, naklady: 143870, technologie: 'REKUPERACE', otevreno: '2026-02-24', popis: '' },
  { kod: 'OP-26-044', predmet: '3+1 klima', klient: 'Vladan Mohelník', ico: null, mesto: '', ulice: '', telefon: '420 773 772 844', email: 'V.Mohelnik@seznam.cz', stav: 'NABIDKA', cenaBezDph: 136920, cenaSDph: 153350.4, naklady: 55226.28, technologie: 'KLIMA', otevreno: '2026-02-24', popis: '' },
  { kod: 'OP-26-016', predmet: 'TČ', klient: 'Ing. Stanislav Tomáš', ico: null, mesto: '', ulice: '', telefon: '778887668', email: 'stanislav.tomas@outlook.com', stav: 'NABIDKA', cenaBezDph: 379873, cenaSDph: 425457.76, naklady: 242236, technologie: 'TEPELNE_CERPADLO', otevreno: '2026-02-12', popis: '300 000 tč max' },
  { kod: 'OP-26-015', predmet: 'VZT Ostrava', klient: 'Darja Makarova', ico: null, mesto: '', ulice: '', telefon: null, email: 'makarovadarija@seznam.cz', stav: 'ZAKAZKA', cenaBezDph: 122137, cenaSDph: 147785.77, naklady: 0, technologie: 'VZDUCHOTECHNIKA', otevreno: '2026-02-12', popis: '' },
  { kod: 'OP-26-014', predmet: 'Klimatizace - Samsung', klient: 'Petra Foltová', ico: null, mesto: '', ulice: '', telefon: '420732193167', email: 'foltova.petra@gmail.com', stav: 'NABIDKA', cenaBezDph: 181716, cenaSDph: 203521.92, naklady: 77969, technologie: 'KLIMA', otevreno: '2026-02-12', popis: '' },
  { kod: 'OP-26-013', predmet: 'TČ', klient: 'Petra Foltová', ico: null, mesto: '', ulice: '', telefon: '420732193167', email: 'foltova.petra@gmail.com', stav: 'NABIDKA', cenaBezDph: 319492, cenaSDph: 357831.04, naklady: 232422, technologie: 'TEPELNE_CERPADLO', otevreno: '2026-02-10', popis: '' },
  { kod: 'OP-26-012', predmet: 'Klimatizace - příprava 2+1', klient: 'Petra Foltová', ico: null, mesto: '', ulice: '', telefon: '420732193167', email: 'foltova.petra@gmail.com', stav: 'NABIDKA', cenaBezDph: 24570, cenaSDph: 27518.4, naklady: 8018, technologie: 'KLIMA', otevreno: '2026-02-10', popis: '' },
  { kod: 'OP-26-011', predmet: 'Klimatizace', klient: 'Ing. Stanislav Tomáš', ico: null, mesto: '', ulice: '', telefon: '778887668', email: 'stanislav.tomas@outlook.com', stav: 'NABIDKA', cenaBezDph: 104498, cenaSDph: 117037.76, naklady: 45099, technologie: 'KLIMA', otevreno: '2026-02-09', popis: '' },
  { kod: 'OP-26-009', predmet: 'Reku - Zehnder - klasické boxy', klient: 'Ing. Stanislav Tomáš', ico: null, mesto: '', ulice: '', telefon: '778887668', email: 'stanislav.tomas@outlook.com', stav: 'NABIDKA', cenaBezDph: 190666, cenaSDph: 213545.92, naklady: 97570, technologie: 'REKUPERACE', otevreno: '2026-02-09', popis: '150 000 komvovent' },
  { kod: 'OP-26-004', predmet: 'rodiče Moravská Nová Ves', klient: 'Jan Šimurda', ico: null, mesto: '', ulice: '', telefon: null, email: null, stav: 'NABIDKA', cenaBezDph: 125985, cenaSDph: 141103.2, naklady: 109920, technologie: 'REKUPERACE', otevreno: '2026-01-16', popis: '' },
  { kod: 'OP-26-003', predmet: 'rodiče Moravská Nová Ves', klient: 'Jan Šimurda', ico: null, mesto: '', ulice: '', telefon: null, email: null, stav: 'NABIDKA', cenaBezDph: 115706, cenaSDph: 129590.72, naklady: 100789, technologie: 'KLIMA', otevreno: '2026-01-15', popis: '' },
  { kod: 'OP-25-125', predmet: 'Klimy - priprava', klient: 'Martin Klega', ico: null, mesto: '', ulice: '', telefon: '725174941', email: 'klegamartin@seznam.cz', stav: 'PRED_UZAVRENIM', cenaBezDph: 42230, cenaSDph: 47297.6, naklady: 14868, technologie: 'KLIMA', otevreno: '2025-11-25', popis: '' },
  { kod: 'OP-25-121', predmet: 'Reku', klient: 'Martin Klega', ico: null, mesto: '', ulice: '', telefon: '725174941', email: 'klegamartin@seznam.cz', stav: 'PRED_UZAVRENIM', cenaBezDph: 271503, cenaSDph: 304083.36, naklady: 169542, technologie: 'REKUPERACE', otevreno: '2025-10-31', popis: '' },
  { kod: 'OP-25-116', predmet: 'TEST', klient: 'Radek Kunčický', ico: null, mesto: 'Orlová 4', ulice: 'Rodinná 4', telefon: '724347986', email: 'radek.kuncicky@gmail.com', stav: 'KONTAKTOVAN', cenaBezDph: 552515, cenaSDph: 618816.8, naklady: 222886, technologie: 'TEPELNE_CERPADLO', otevreno: '2025-10-23', popis: '' },
  { kod: 'OP-25-096', predmet: 'klimy 1E', klient: 'p. Švarc', ico: null, mesto: '', ulice: '', telefon: '601590552', email: null, stav: 'KONTAKTOVAN', cenaBezDph: 206331, cenaSDph: 231090.72, naklady: 83434, technologie: 'KLIMA', otevreno: '2025-09-05', popis: '' },
]

function mapStav(stav: string): string {
  const map: Record<string, string> = {
    ZAKAZKA: 'USPECH',
    KONTAKTOVAN: 'JEDNANI',
    NOVY: 'NOVY',
    JEDNANI: 'JEDNANI',
    NABIDKA: 'NABIDKA',
    PRED_UZAVRENIM: 'PRED_UZAVRENIM',
    USPECH: 'USPECH',
    PAS: 'PAS',
  }
  return map[stav] ?? 'NOVY'
}

function mapTech(tech: string): string {
  const map: Record<string, string> = {
    PODLAHOVE_VYTAPENI: 'PODLAHOVE_TOPENI',
  }
  return map[tech] ?? tech
}

async function main() {
  // Najdi NANTO org
  const org = await prisma.organization.findFirst({
    where: { slug: 'nanto' }
  })
  if (!org) throw new Error('NANTO org nenalezena! Zkontroluj slug.')
  console.log(`✓ Nalezena org: ${org.nazev} (${org.id})`)

  // Najdi admina pro orgId
  const adminUser = await prisma.user.findFirst({
    where: { orgId: org.id, role: 'ADMIN' }
  })
  if (!adminUser) throw new Error('Admin user nenalezen!')
  console.log(`✓ Admin: ${adminUser.email}`)

  // === SMAZÁNÍ VŠECH EXISTUJÍCÍCH OP ===
  console.log('\n🗑️  Mažu existující OP...')

  const existingDeals = await prisma.deal.findMany({
    where: { orgId: org.id },
    select: { id: true, kod: true }
  })
  console.log(`   Nalezeno ${existingDeals.length} existujících OP`)

  for (const deal of existingDeals) {
    await prisma.$transaction(async (tx) => {
      // Smaž v správném pořadí
      const quotes = await tx.quote.findMany({ where: { dealId: deal.id } })
      for (const q of quotes) {
        await tx.quoteItem.deleteMany({ where: { quoteId: q.id } })
      }
      await tx.quote.deleteMany({ where: { dealId: deal.id } })
      await tx.activity.deleteMany({ where: { dealId: deal.id } })
      await tx.photo.deleteMany({ where: { dealId: deal.id } })

      // Custom field values
      try {
        await (tx as any).customFieldValue.deleteMany({ where: { dealId: deal.id } })
      } catch {}

      // Servisní záznamy
      try {
        const kontrakty = await (tx as any).servisniKontrakt.findMany({ where: { dealId: deal.id } })
        for (const k of kontrakty) {
          await (tx as any).servisniNavsteva.deleteMany({ where: { kontraktId: k.id } })
        }
        await (tx as any).servisniKontrakt.deleteMany({ where: { dealId: deal.id } })
        await (tx as any).zarizeni.deleteMany({ where: { dealId: deal.id } })
      } catch {}

      await tx.deal.delete({ where: { id: deal.id } })
    })
    console.log(`   ✓ Smazán ${deal.kod || deal.id}`)
  }

  console.log('\n📥 Importuji nové OP...')

  let created = 0
  let clientsCreated = 0

  for (const op of OPS) {
    // Najdi nebo vytvoř klienta
    const searchParts = op.klient.trim().split(/\s+/)
    const searchPrijmeni = searchParts.length > 1 ? searchParts[searchParts.length - 1] : ''
    const searchJmeno = searchParts.slice(0, -1).join(' ')

    let client = await prisma.client.findFirst({
      where: {
        orgId: org.id,
        OR: [
          ...(op.email ? [{ email: op.email }] : []),
          { jmeno: searchJmeno, prijmeni: searchPrijmeni },
          { jmeno: op.klient },
        ]
      }
    })

    if (!client) {
      // Rozdělení jména: poslední slovo → prijmeni, zbytek → jmeno
      const nameParts = op.klient.trim().split(/\s+/)
      const prijmeni = nameParts.length > 1 ? nameParts.pop()! : ''
      const jmeno = nameParts.join(' ')

      client = await prisma.client.create({
        data: {
          orgId: org.id,
          jmeno,
          prijmeni,
          telefon: op.telefon || null,
          email: op.email || null,
        }
      })
      clientsCreated++
    }

    // Vytvoř OP
    await prisma.deal.create({
      data: {
        organization: { connect: { id: org.id } },
        client: { connect: { id: client.id } },
        user: { connect: { id: adminUser.id } },
        kod: op.kod,
        predmet: op.predmet,
        stav: mapStav(op.stav) as any,
        technologie: mapTech(op.technologie) as any,
        poznamky: op.popis || null,
        vytvoreno: new Date(op.otevreno),
      }
    })

    console.log(`   ✓ ${op.kod} | ${op.predmet} | ${op.klient} | ${op.stav}`)
    created++
  }

  console.log(`\n✅ Hotovo!`)
  console.log(`   OP importováno: ${created}`)
  console.log(`   Klientů vytvořeno: ${clientsCreated}`)
  console.log(`   Existujících klientů použito: ${created - clientsCreated}`)
}

main()
  .catch(e => {
    console.error('❌ Chyba:', e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
