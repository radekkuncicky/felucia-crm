import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Running v2 seed...')

  const org = await prisma.organization.findFirst({ where: { slug: 'felucia' } })
  if (!org) throw new Error('No org found')

  // Create categories
  const catKlima = await prisma.category.upsert({
    where: { id: 'cat-klima' },
    update: {},
    create: { id: 'cat-klima', orgId: org.id, nazev: 'Klimatizace', barva: '#3B82F6', poradi: 1 },
  })
  const catTC = await prisma.category.upsert({
    where: { id: 'cat-tc' },
    update: {},
    create: { id: 'cat-tc', orgId: org.id, nazev: 'Tepelná čerpadla', barva: '#F59E0B', poradi: 2 },
  })
  const catMont = await prisma.category.upsert({
    where: { id: 'cat-mont' },
    update: {},
    create: { id: 'cat-mont', orgId: org.id, nazev: 'Montáž', barva: '#10B981', poradi: 3 },
  })
  const catMat = await prisma.category.upsert({
    where: { id: 'cat-mat' },
    update: {},
    create: { id: 'cat-mat', orgId: org.id, nazev: 'Materiál', barva: '#8B5CF6', poradi: 4 },
  })

  console.log('Categories created')

  console.log('Categories created (product assignment now done via M2M in product detail)')

  // Generate codes for existing deals
  const deals = await prisma.deal.findMany({ where: { orgId: org.id, kod: null }, orderBy: { vytvoreno: 'asc' } })
  let counter = 1
  for (const deal of deals) {
    const yr = new Date(deal.vytvoreno).getFullYear() % 100
    const kod = `OP-${yr.toString().padStart(2, '0')}-${counter.toString().padStart(3, '0')}`
    await prisma.deal.update({ where: { id: deal.id }, data: { kod } })
    counter++
  }
  console.log(`Generated codes for ${deals.length} deals`)

  // Create Quote for each deal that has QuoteItems but no Quote
  const dealsWithItems = await prisma.deal.findMany({
    where: { orgId: org.id },
    include: { quoteItems: { where: { quoteId: null } }, quotes: true },
  })

  for (const deal of dealsWithItems) {
    if (deal.quoteItems.length > 0 && deal.quotes.length === 0) {
      const quote = await prisma.quote.create({
        data: {
          orgId: org.id,
          dealId: deal.id,
          nazev: 'Nabídka 1',
          aktivni: true,
        },
      })
      // Assign existing QuoteItems to this quote
      await prisma.quoteItem.updateMany({
        where: { dealId: deal.id, quoteId: null },
        data: { quoteId: quote.id },
      })
      console.log(`Created Quote for deal ${deal.kod ?? deal.id}`)
    }
  }

  console.log('\nV2 seed completed!')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
