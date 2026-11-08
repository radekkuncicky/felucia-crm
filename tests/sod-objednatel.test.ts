import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { rozlozAdresu } from '@/lib/klientAdresa'
import { overObjednatele } from '@/lib/sodObjednatel'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
import { getServerSession } from 'next-auth'
import { POST as sodPost } from '@/app/api/sod/route'

const RUN = `sod-obj-${Date.now()}`
let orgId: string
let templateId: string

beforeAll(async () => {
  orgId = (await prisma.organization.create({ data: { nazev: 'SOD objednatel', slug: RUN, plan: 'STANDARD' } })).id
  const user = await prisma.user.create({ data: { orgId, jmeno: 'A', email: `${RUN}@example.com`, role: 'ADMIN', hesloHash: 'x' } })
  templateId = (await prisma.contractTemplate.create({
    data: { orgId, nazev: 'T', obsah: '<p>Objednatel {{klient_jmeno}}, IČO {{klient_ico}}, Sídlo {{klient_adresa}}. Místo instalace {{adresa_dila}}.</p>' },
  })).id
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id, orgId, role: 'ADMIN' } } as never)
})

afterAll(async () => {
  await prisma.sod.deleteMany({ where: { orgId } })
  await prisma.deal.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.contractTemplate.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.orgSettings.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
  await prisma.$disconnect()
})

async function firmaBezAdresy(kod: string) {
  const client = await prisma.client.create({ data: { orgId, typKlienta: 'FIRMA', jmeno: `Firma ${kod} s.r.o.`, prijmeni: '' } })
  const deal = await prisma.deal.create({ data: { orgId, clientId: client.id, predmet: 'TČ', kod: `${RUN}-${kod}`, technologie: 'TEPELNE_CERPADLO' } })
  return { client, deal }
}

const post = (body: Record<string, unknown>) =>
  sodPost(new Request('http://localhost/api/sod', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))

describe('rozlozAdresu', () => {
  it('rozloží jednořádkovou adresu', () => {
    expect(rozlozAdresu('Mysločovice 179, 763 01 Mysločovice, Česko')).toEqual({ ulice: 'Mysločovice 179', mesto: 'Mysločovice', psc: '763 01' })
    expect(rozlozAdresu('Školní 361/27, 735 01, Havířov')).toEqual({ ulice: 'Školní 361/27', mesto: 'Havířov', psc: '735 01' })
    expect(rozlozAdresu('Brno')).toEqual({ ulice: null, mesto: 'Brno', psc: null })
    expect(rozlozAdresu('  ')).toBeNull()
  })
})

describe('overObjednatele', () => {
  it('vyžaduje sídlo a výslovné potvrzení místa instalace', () => {
    expect(overObjednatele({ mistoShodne: true })).toMatch(/sídlo/)
    expect(overObjednatele({ klientAdresa: 'A 1, Brno' })).toMatch(/Potvrďte/)
    expect(overObjednatele({ klientAdresa: 'A 1, Brno', mistoShodne: false })).toMatch(/místo instalace/)
    expect(overObjednatele({ klientAdresa: 'A 1, Brno', mistoShodne: true, adresaDila: 'Jinde 5' })).toMatchObject({ adresaDila: 'A 1, Brno' })
  })
})

describe('POST /api/sod — sídlo vs. místo instalace', () => {
  it('bez potvrzení 400 a smlouva nevznikne', async () => {
    const { deal } = await firmaBezAdresy('a')
    const res = await post({ dealId: deal.id, templateId, klientAdresa: 'Sídlo 1, 110 00 Praha' })
    expect(res.status).toBe(400)
    expect(await prisma.sod.count({ where: { dealId: deal.id } })).toBe(0)
  })

  it('jiné místo instalace: smlouva má sídlo i místo zvlášť, klient dostane sídlo a IČO', async () => {
    const { client, deal } = await firmaBezAdresy('b')
    const res = await post({
      dealId: deal.id, templateId, klientAdresa: 'Václavské nám. 1, 110 00 Praha', klientIco: '12345678',
      mistoShodne: false, adresaDila: 'Mysločovice 179, 763 01 Mysločovice',
    })
    expect(res.status).toBe(201)
    const sod = await res.json()
    expect(sod).toMatchObject({ klientAdresa: 'Václavské nám. 1, 110 00 Praha', adresaDila: 'Mysločovice 179, 763 01 Mysločovice', klientIco: '12345678' })
    expect(sod.textSmlouvy).toContain('Sídlo Václavské nám. 1, 110 00 Praha')
    expect(sod.textSmlouvy).toContain('Místo instalace Mysločovice 179')
    expect(sod.textSmlouvy).toContain('IČO 12345678')
    expect(await prisma.client.findUnique({ where: { id: client.id } })).toMatchObject({ ulice: 'Václavské nám. 1', mesto: 'Praha', psc: '110 00', ico: '12345678' })
    expect((await prisma.deal.findUnique({ where: { id: deal.id } }))?.adresaDila).toBe('Mysločovice 179, 763 01 Mysločovice')
  })

  it('shodné místo: adresa díla = sídlo; vyplněná karta klienta se nepřepíše', async () => {
    const { client, deal } = await firmaBezAdresy('c')
    await prisma.client.update({ where: { id: client.id }, data: { ulice: 'Původní 2', mesto: 'Ostrava' } })
    const res = await post({ dealId: deal.id, templateId, klientAdresa: 'Nová 3, 700 30 Ostrava', mistoShodne: true })
    const sod = await res.json()
    expect(sod.adresaDila).toBe('Nová 3, 700 30 Ostrava')
    expect(await prisma.client.findUnique({ where: { id: client.id } })).toMatchObject({ ulice: 'Původní 2', mesto: 'Ostrava' })
  })
})
