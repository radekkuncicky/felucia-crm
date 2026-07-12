import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  updateServisniZakazka,
  createServisniZakazka,
  createReklamace,
  naplanujDalsiNavstevu,
} from '@/lib/servisZakazkaService'
import { jePovolenyPrechod, SERVIS_STAV_PRECHODY } from '@/lib/servisStav'

/**
 * Stavový stroj servisních zakázek nad nanto_crm_test: guardy přechodů
 * (updateServisniZakazka), dogenerace další návštěvy kontraktu po dokončení
 * a reklamace jako nová navázaná zakázka (puvodniZakazkaId).
 */

const RUN = `servis-${Date.now()}`

let orgId: string
let klientId: string
let kontraktId: string

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test Servis Stavy', slug: RUN } })
  orgId = org.id
  const klient = await prisma.client.create({
    data: { orgId, jmeno: 'Servisní', prijmeni: 'Klient' },
  })
  klientId = klient.id
  const kontrakt = await prisma.servisniKontrakt.create({
    data: {
      orgId,
      klientId,
      nazev: 'Roční servis TČ',
      typ: 'ROCNI',
      intervalMesicu: 12,
      zacatek: new Date(),
      aktivni: true,
    },
  })
  kontraktId = kontrakt.id
})

afterAll(async () => {
  await prisma.webhookOutbox.deleteMany({ where: { orgId } })
  await prisma.servisniZakazka.deleteMany({ where: { orgId } })
  await prisma.servisniKontrakt.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
  await prisma.$disconnect()
})

async function novaZakazka(input: Record<string, unknown> = {}) {
  const res = await createServisniZakazka(orgId, input)
  if (!res.ok) throw new Error(res.error)
  return res.data as { id: string; stav: string; cislo: string }
}

describe('mapa přechodů', () => {
  it('hlavní cesta je průchozí, konec je konec', () => {
    expect(jePovolenyPrechod('NOVA', 'NAPLANOVANA')).toBe(true)
    expect(jePovolenyPrechod('NAPLANOVANA', 'PROBIHA')).toBe(true)
    expect(jePovolenyPrechod('PROBIHA', 'DOKONCENA')).toBe(true)
    expect(jePovolenyPrechod('VYUCTOVANA', 'UZAVRENA')).toBe(true)
    expect(SERVIS_STAV_PRECHODY.UZAVRENA).toHaveLength(0)
  })

  it('nesmysly neprojdou (VYUCTOVANA zpět na NOVA, DOKONCENA na UZAVRENA)', () => {
    expect(jePovolenyPrechod('VYUCTOVANA', 'NOVA')).toBe(false)
    expect(jePovolenyPrechod('DOKONCENA', 'UZAVRENA')).toBe(false)
  })
})

describe('guard v updateServisniZakazka', () => {
  it('povolený přechod projde (NAPLANOVANA -> PROBIHA)', async () => {
    const z = await novaZakazka({ planovanyTermin: new Date().toISOString() })
    expect(z.stav).toBe('NAPLANOVANA')
    const res = await updateServisniZakazka(orgId, z.id, { stav: 'PROBIHA' })
    expect(res.ok).toBe(true)
  })

  it('nepovolený přechod vrátí 422 s čitelnou chybou', async () => {
    const z = await novaZakazka({ planovanyTermin: new Date().toISOString() })
    const res = await updateServisniZakazka(orgId, z.id, { stav: 'UZAVRENA' })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.status).toBe(422)
      expect(res.error).toContain('není povolen')
    }
  })

  it('forceStav (admin escape hatch) nepovolený přechod pustí', async () => {
    const z = await novaZakazka({ planovanyTermin: new Date().toISOString() })
    const res = await updateServisniZakazka(orgId, z.id, { stav: 'UZAVRENA' }, { forceStav: true })
    expect(res.ok).toBe(true)
  })

  it('stejný stav znovu není přechod — projde', async () => {
    const z = await novaZakazka({ planovanyTermin: new Date().toISOString() })
    const res = await updateServisniZakazka(orgId, z.id, { stav: 'NAPLANOVANA', poznamka: 'beze změny stavu' })
    expect(res.ok).toBe(true)
  })
})

describe('dogenerace další návštěvy kontraktu', () => {
  it('dokončení kontraktní zakázky naplánuje další (+interval), jednou', async () => {
    const skutecny = new Date('2026-07-10T09:00:00Z')
    const z = await novaZakazka({
      planovanyTermin: '2026-07-10T08:00:00Z',
      kontraktId,
      klientId,
    })
    await updateServisniZakazka(orgId, z.id, { stav: 'PROBIHA' })
    const res = await updateServisniZakazka(orgId, z.id, {
      stav: 'DOKONCENA',
      skutecnyTermin: skutecny.toISOString(),
    })
    expect(res.ok).toBe(true)

    const dalsi = await prisma.servisniZakazka.findMany({
      where: { orgId, kontraktId, stav: 'NAPLANOVANA', id: { not: z.id } },
    })
    expect(dalsi).toHaveLength(1)
    expect(dalsi[0].planovanyTermin?.toISOString().slice(0, 7)).toBe('2027-07')
    expect(dalsi[0].cislo).toMatch(/^SZ-\d{2}-\d{4}$/)

    // Existuje budoucí NAPLANOVANA -> další dokončení nesmí duplikovat
    const dalsiPokus = await naplanujDalsiNavstevu(orgId, {
      id: z.id,
      kontraktId,
      zarizeniId: null,
      klientId,
      technikId: null,
      skutecnyTermin: skutecny,
    })
    expect(dalsiPokus).toBeNull()
  })

  it('zakázka bez kontraktu nic negeneruje', async () => {
    const pred = await prisma.servisniZakazka.count({ where: { orgId } })
    const z = await novaZakazka({ planovanyTermin: new Date().toISOString(), klientId })
    await updateServisniZakazka(orgId, z.id, { stav: 'PROBIHA' })
    await updateServisniZakazka(orgId, z.id, { stav: 'DOKONCENA' })
    const po = await prisma.servisniZakazka.count({ where: { orgId } })
    expect(po).toBe(pred + 1) // jen ta jedna nová, žádná dogenerovaná
  })
})

describe('reklamace', () => {
  it('z dokončené zakázky založí novou NOVA navázanou přes puvodniZakazkaId', async () => {
    const z = await novaZakazka({ planovanyTermin: new Date().toISOString(), klientId })
    await updateServisniZakazka(orgId, z.id, { stav: 'PROBIHA' })
    await updateServisniZakazka(orgId, z.id, { stav: 'DOKONCENA' })

    const res = await createReklamace(orgId, z.id, { poznamka: 'Jednotka píská' })
    expect(res.ok).toBe(true)
    if (res.ok) {
      const r = await prisma.servisniZakazka.findUnique({ where: { id: res.data.id } })
      expect(r?.stav).toBe('NOVA')
      expect(r?.puvodniZakazkaId).toBe(z.id)
      expect(r?.planovanyTermin).toBeNull()
      expect(r?.typ).toBe('ZARUCNI_OPRAVA')
      expect(r?.poznamka).toBe('Jednotka píská')
      expect(r?.klientId).toBe(klientId)
    }
  })

  it('rozdělanou zakázku reklamovat nejde', async () => {
    const z = await novaZakazka({ planovanyTermin: new Date().toISOString() })
    const res = await createReklamace(orgId, z.id)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(422)
  })
})
