import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { POST as sodPost } from '@/app/api/sod/route'
import { getServerSession } from 'next-auth'

const RUN = `sod-create-${Date.now()}`

let orgId: string
let userId: string
let dealId: string
let templateId: string

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test SOD Create', slug: RUN, plan: 'STANDARD' } })
  orgId = org.id
  const user = await prisma.user.create({
    data: { orgId, jmeno: 'Oto Obchodník', email: `${RUN}@example.com`, role: 'OBCHODNIK', hesloHash: 'x' },
  })
  userId = user.id
  const client = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Klient' } })
  const deal = await prisma.deal.create({
    data: { orgId, clientId: client.id, predmet: 'Klimatizace', kod: `${RUN}-op`, technologie: 'KLIMA' },
  })
  dealId = deal.id
  const quote = await prisma.quote.create({ data: { orgId, dealId, nazev: 'Nabídka 1', dphSazba: 21, aktivni: true } })
  await prisma.quoteItem.create({
    data: { dealId, quoteId: quote.id, nazev: 'Klimatizace jednotka', mnozstvi: 2, cenaZaKus: 25000, sleva: 0 },
  })
  const template = await prisma.contractTemplate.create({
    data: {
      orgId,
      nazev: 'Testovací šablona',
      obsah: '<p>Cena bez DPH: {{konecna_cena}}, DPH {{dph_sazba}} %, Cena s DPH: {{cena_s_dph}}</p>',
    },
  })
  templateId = template.id

  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId, orgId, role: 'OBCHODNIK' } } as never)
})

afterAll(async () => {
  await prisma.sod.deleteMany({ where: { orgId } })
  await prisma.quoteItem.deleteMany({ where: { dealId } })
  await prisma.quote.deleteMany({ where: { orgId } })
  await prisma.contractTemplate.deleteMany({ where: { orgId } })
  await prisma.deal.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
  await prisma.$disconnect()
})

function post(body: Record<string, unknown>) {
  return new Request('http://localhost/api/sod', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Sanitizace/formátování může nezalomitelnou mezeru v čísle přepsat na
// &nbsp; entitu nebo jiný whitespace znak — pro porovnání textu ji sjednotíme.
function normalizeWhitespace(text: string): string {
  return text.replace(/&nbsp;/g, ' ').replace(/[\s ]+/g, ' ')
}

describe('POST /api/sod — cena u šablonového flow (bez explicitních cena polí)', () => {
  it('cenaBezDph/cenaSDph/dphSazba v DB odpovídají částkám v textu smlouvy', async () => {
    const res = await sodPost(post({ dealId, templateId, overrides: {} }))
    expect(res.status).toBe(201)
    const sod = await res.json()

    // 2 × 25 000 Kč bez slevy = 50 000 Kč bez DPH, 21 % DPH -> 60 500 Kč
    expect(Number(sod.cenaBezDph)).toBe(50000)
    expect(Number(sod.dphSazba)).toBe(21)
    expect(Number(sod.cenaSDph)).toBe(60500)

    // stejné částky musí být i v textu vygenerované smlouvy
    const text = normalizeWhitespace(sod.textSmlouvy as string)
    expect(text).toContain('50 000 Kč')
    expect(text).toContain('60 500 Kč')
    expect(text).toContain('21 %')
  })

  it('explicitně poslané cenové pole (typový flow) má přednost před dopočtem', async () => {
    const res = await sodPost(post({
      dealId,
      typ: 'DPH_12_SE_ZALOHOU',
      klientJmeno: 'Karel Klient',
      predmetDila: 'Klimatizace',
      cenaBezDph: 12345,
      cenaSDph: 13827,
      dphSazba: 12,
    }))
    expect(res.status).toBe(201)
    const sod = await res.json()
    expect(Number(sod.cenaBezDph)).toBe(12345)
    expect(Number(sod.cenaSDph)).toBe(13827)
    expect(Number(sod.dphSazba)).toBe(12)
  })
})
