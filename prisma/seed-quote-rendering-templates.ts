import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // ── NANTO org: SYSTEM šablony ────────────────────────────────────────────
  const nantoOrg = await prisma.organization.findFirst({ where: { slug: 'nanto' } })

  if (nantoOrg) {
    const systemTemplates = [
      { nazev: 'NANTO – Tepelné čerpadlo', technologie: 'TEPELNE_CERPADLO' as const, isDefault: true },
      { nazev: 'NANTO – Klimatizace', technologie: 'KLIMA' as const, isDefault: false },
      { nazev: 'NANTO – Rekuperace', technologie: 'REKUPERACE' as const, isDefault: false },
      { nazev: 'NANTO – Podlahové vytápění', technologie: 'PODLAHOVE_TOPENI' as const, isDefault: false },
      { nazev: 'NANTO – Vzduchotechnika', technologie: 'VZDUCHOTECHNIKA' as const, isDefault: false },
    ]

    for (const tpl of systemTemplates) {
      const existing = await prisma.quoteTemplate.findFirst({
        where: { orgId: nantoOrg.id, nazev: tpl.nazev, isSystem: true },
      })
      if (!existing) {
        await prisma.quoteTemplate.create({
          data: {
            orgId: nantoOrg.id,
            nazev: tpl.nazev,
            typ: 'SYSTEM',
            isSystem: true,
            isDefault: tpl.isDefault,
            planRequired: 'STARTER',
            technologie: tpl.technologie,
          },
        })
        console.log(`✓ Vytvořena SYSTEM šablona: ${tpl.nazev}`)
      } else {
        console.log(`– Přeskočena (existuje): ${tpl.nazev}`)
      }
    }
  } else {
    console.log('! Org s slug "nanto" nenalezena, přeskakuji SYSTEM šablony')
  }

  // ── Všechny ostatní org: BASE výchozí šablona ────────────────────────────
  const allOrgs = await prisma.organization.findMany()

  for (const org of allOrgs) {
    if (nantoOrg && org.id === nantoOrg.id) continue

    const existing = await prisma.quoteTemplate.findFirst({
      where: { orgId: org.id, isDefault: true, typ: { in: ['BASE', 'STANDARD', 'CUSTOM_HTML'] } },
    })
    if (!existing) {
      await prisma.quoteTemplate.create({
        data: {
          orgId: org.id,
          nazev: 'Základní nabídka',
          typ: 'BASE',
          isDefault: true,
          planRequired: 'STARTER',
          config: {
            create: { primaryColor: '#4CAF50' },
          },
        },
      })
      console.log(`✓ Vytvořena BASE šablona pro org: ${org.nazev}`)
    } else {
      console.log(`– Přeskočena org: ${org.nazev} (výchozí šablona již existuje)`)
    }
  }

  console.log('\n✅ Seed renderovacích šablon dokončen')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
