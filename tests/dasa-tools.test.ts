import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { executeDasaTool, type DasaUser } from '@/lib/dasaTools'
import { ROLE_PRESETS } from '@/lib/permissions'

/**
 * Integrační test nástrojů Dáši nad nanto_crm_test — scénář „rychlá cenovka":
 * vzorová nabídka → položky → create_quote s upraveným množstvím + jednotkou z katalogu.
 */

const RUN = `dasa-${Date.now()}`

let org: { id: string }
let cizzyOrg: { id: string }
let user: DasaUser
let technik: DasaUser
let clientId: string
let dealId: string
let templateId: string
let renderTemplateId: string
let cizziTemplateId: string
let productId: string

beforeAll(async () => {
  org = await prisma.organization.create({ data: { nazev: 'Dáša Test', slug: RUN } })
  cizzyOrg = await prisma.organization.create({ data: { nazev: 'Cizí org', slug: `${RUN}-b` } })

  const dbUser = await prisma.user.create({
    data: { orgId: org.id, jmeno: 'Radek Test', email: `${RUN}@test.cz`, hesloHash: 'x', role: 'ADMIN' },
  })
  user = { id: dbUser.id, orgId: org.id, role: 'ADMIN', jmeno: dbUser.jmeno, perms: ROLE_PRESETS.ADMIN }
  technik = { ...user, role: 'TECHNIK', perms: ROLE_PRESETS.TECHNIK }

  const client = await prisma.client.create({
    data: { orgId: org.id, jmeno: 'Karel', prijmeni: 'Novák' },
  })
  clientId = client.id

  const deal = await prisma.deal.create({
    data: { orgId: org.id, clientId, userId: dbUser.id, technologie: 'KLIMA', kod: 'OP-99-901' },
  })
  dealId = deal.id

  const product = await prisma.product.create({
    data: { orgId: org.id, nazev: 'GREE PULAR 12 test', kod: 'GREE-PULAR-12-T', standardniCena: 8744, jednotka: 'ks' },
  })
  productId = product.id

  const template = await prisma.quoteTemplate.create({
    data: {
      orgId: org.id,
      nazev: 'Klimy test',
      technologie: 'KLIMA',
      polozky: [
        { nazev: 'Cu potrubí 6/10', mnozstvi: 1, cena_za_kus: 412, jednotka: 'm', product_id: productId },
        { nazev: 'Montáž vnitřní jednotky', mnozstvi: 1, cena_za_kus: 2500 },
      ],
    },
  })
  templateId = template.id

  // Render šablona bez položek — nesmí se nabízet jako vzor
  const renderTemplate = await prisma.quoteTemplate.create({
    data: { orgId: org.id, nazev: 'PDF vzhled', typ: 'STANDARD', polozky: [] },
  })
  renderTemplateId = renderTemplate.id

  const cizziTemplate = await prisma.quoteTemplate.create({
    data: {
      orgId: cizzyOrg.id,
      nazev: 'Cizí šablona',
      polozky: [{ nazev: 'Tajná položka', mnozstvi: 1, cena_za_kus: 1 }],
    },
  })
  cizziTemplateId = cizziTemplate.id
})

afterAll(async () => {
  const orgIds = [org.id, cizzyOrg.id]
  await prisma.quoteItem.deleteMany({ where: { deal: { orgId: { in: orgIds } } } })
  await prisma.quote.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.quoteTemplate.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.deal.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.client.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.product.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.user.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
  await prisma.$disconnect()
})

describe('list_quote_templates', () => {
  it('vrací vzorové nabídky s počtem položek', async () => {
    const { result } = await executeDasaTool('list_quote_templates', {}, user)
    const parsed = JSON.parse(result)
    expect(Array.isArray(parsed)).toBe(true)
    const tpl = parsed.find((t: { id: string }) => t.id === templateId)
    expect(tpl).toBeDefined()
    expect(tpl.nazev).toBe('Klimy test')
    expect(tpl.technologie).toBe('KLIMA')
    expect(tpl.pocetPolozek).toBe(2)
  })

  it('nevrací render šablony bez položek', async () => {
    const { result } = await executeDasaTool('list_quote_templates', {}, user)
    const parsed = JSON.parse(result)
    expect(parsed.find((t: { id: string }) => t.id === renderTemplateId)).toBeUndefined()
  })

  it('nevrací šablony cizí organizace', async () => {
    const { result } = await executeDasaTool('list_quote_templates', {}, user)
    const parsed = JSON.parse(result)
    expect(parsed.find((t: { id: string }) => t.id === cizziTemplateId)).toBeUndefined()
  })

  it('technik nemá přístup', async () => {
    const { result } = await executeDasaTool('list_quote_templates', {}, technik)
    expect(JSON.parse(result).chyba).toBeDefined()
  })
})

describe('get_quote_template', () => {
  it('vrací položky ve formátu create_quote', async () => {
    const { result } = await executeDasaTool('get_quote_template', { templateId }, user)
    const parsed = JSON.parse(result)
    expect(parsed.nazev).toBe('Klimy test')
    expect(parsed.items).toHaveLength(2)
    expect(parsed.items[0]).toEqual({
      nazev: 'Cu potrubí 6/10',
      mnozstvi: 1,
      cenaZaKus: 412,
      jednotka: 'm',
      productId,
    })
    expect(parsed.items[1].productId).toBeUndefined()
  })

  it('šablonu cizí org nenajde', async () => {
    const { result } = await executeDasaTool('get_quote_template', { templateId: cizziTemplateId }, user)
    expect(JSON.parse(result).chyba).toBeDefined()
  })

  it('technik nemá přístup', async () => {
    const { result } = await executeDasaTool('get_quote_template', { templateId }, technik)
    expect(JSON.parse(result).chyba).toBeDefined()
  })
})

describe('create_quote — rychlá cenovka ze vzoru', () => {
  it('založí nabídku z položek vzoru + jednotky z katalogu s upraveným množstvím', async () => {
    const tplRes = await executeDasaTool('get_quote_template', { templateId }, user)
    const tpl = JSON.parse(tplRes.result)

    // Dáša upraví metry potrubí a přidá jednotku z katalogu
    const items = [
      { ...tpl.items[0], mnozstvi: 6 },
      tpl.items[1],
      { nazev: 'GREE PULAR 12 test', mnozstvi: 1, cenaZaKus: 8744, productId },
    ]

    const { result, navigateTo } = await executeDasaTool(
      'create_quote',
      { dealId: 'OP-99-901', nazev: 'Klima obývák', items },
      user
    )
    const parsed = JSON.parse(result)
    expect(parsed.ok).toBe(true)
    expect(parsed.pocetPolozek).toBe(3)
    expect(parsed.celkemBezDph).toBe(6 * 412 + 2500 + 8744)
    expect(navigateTo).toBe(`/deals/${dealId}`)

    const quote = await prisma.quote.findUnique({
      where: { id: parsed.quoteId },
      include: { items: { orderBy: { poradi: 'asc' } } },
    })
    expect(quote?.orgId).toBe(org.id)
    expect(quote?.kod).toMatch(/^NAB-\d{2}-\d{4}$/)
    expect(quote?.items.map(i => i.productId)).toEqual([productId, null, productId])
    expect(Number(quote?.items[0].mnozstvi)).toBe(6)
  })
})
