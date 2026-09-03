import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // NANTO se přeskakuje: má vlastní sadu šablon bez výchozí (vybírá se per
  // nabídka / mapping). Původní větev se SYSTEM šablonami tu založila 2026-09-03
  // nechtěné prázdné šablony (smazány ručně) — proto byla odstraněna.
  const nantoOrg = await prisma.organization.findFirst({ where: { slug: 'nanto' } })

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
