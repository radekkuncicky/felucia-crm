import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createServisniZakazka, updateServisniZakazka, formatKlientAdresa } from '@/lib/servisZakazkaService'

/**
 * Založení servisní akce „z ulice" (servis/nova) nad nanto_crm_test:
 * nové zařízení v jedné transakci, předvyplnění adresy zásahu z klienta,
 * auto-napojení aktivního kontraktu vybraného zařízení, tenant guardy.
 */

const RUN = `servis-akce-${Date.now()}`

let orgId: string
let ciziOrgId: string
let klientId: string
let ciziKlientId: string
let zarizeniSKontraktemId: string
let kontraktId: string

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test Servis Akce', slug: RUN } })
  orgId = org.id
  const cizi = await prisma.organization.create({ data: { nazev: 'Cizí org', slug: `${RUN}-cizi` } })
  ciziOrgId = cizi.id

  const klient = await prisma.client.create({
    data: { orgId, jmeno: 'Jana', prijmeni: 'Z ulice', ulice: 'Dlouhá 12', mesto: 'Brno', psc: '602 00', telefon: '+420111222333' },
  })
  klientId = klient.id
  const ciziKlient = await prisma.client.create({ data: { orgId: ciziOrgId, jmeno: 'Cizí', prijmeni: 'Klient' } })
  ciziKlientId = ciziKlient.id

  const zarizeni = await prisma.zarizeni.create({
    data: { orgId, klientId, nazev: 'TČ Daikin Altherma', typ: 'TEPELNE_CERPADLO' },
  })
  zarizeniSKontraktemId = zarizeni.id
  const kontrakt = await prisma.servisniKontrakt.create({
    data: {
      orgId,
      klientId,
      zarizeniId: zarizeni.id,
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
  for (const id of [orgId, ciziOrgId]) {
    await prisma.webhookOutbox.deleteMany({ where: { orgId: id } })
    await prisma.servisniZakazka.deleteMany({ where: { orgId: id } })
    await prisma.servisniKontrakt.deleteMany({ where: { orgId: id } })
    await prisma.zarizeni.deleteMany({ where: { orgId: id } })
    await prisma.client.deleteMany({ where: { orgId: id } })
    await prisma.organization.delete({ where: { id } })
  }
  await prisma.$disconnect()
})

describe('formatKlientAdresa', () => {
  it('skládá ulici a PSČ + město, vynechává prázdné', () => {
    expect(formatKlientAdresa({ ulice: 'Dlouhá 12', mesto: 'Brno', psc: '602 00' })).toBe('Dlouhá 12, 602 00 Brno')
    expect(formatKlientAdresa({ ulice: null, mesto: 'Brno', psc: null })).toBe('Brno')
    expect(formatKlientAdresa({ ulice: null, mesto: null, psc: null })).toBeNull()
    expect(formatKlientAdresa(null)).toBeNull()
  })
})

describe('createServisniZakazka — servisní akce', () => {
  it('klient z ulice bez zařízení: NOVA, PORUCHA, popis + priorita, adresa z klienta', async () => {
    const res = await createServisniZakazka(orgId, {
      klientId,
      typ: 'PORUCHA',
      popis: '  Klima nechladí  ',
      priorita: 'URGENTNI',
      kontaktJmeno: 'pan Správce',
      kontaktTelefon: '+420999',
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const z = await prisma.servisniZakazka.findUniqueOrThrow({ where: { id: res.data.id } })
    expect(z.stav).toBe('NOVA')
    expect(z.typ).toBe('PORUCHA')
    expect(z.popis).toBe('Klima nechladí')
    expect(z.priorita).toBe('URGENTNI')
    expect(z.adresaZasahu).toBe('Dlouhá 12, 602 00 Brno')
    expect(z.kontaktJmeno).toBe('pan Správce')
    expect(z.zarizeniId).toBeNull()
    expect(z.kontraktId).toBeNull()
    expect(z.cislo).toMatch(/^SZ-\d{2}-\d{4}$/)
  })

  it('explicitní adresa zásahu má přednost před adresou klienta', async () => {
    const res = await createServisniZakazka(orgId, { klientId, popis: 'x', adresaZasahu: 'Chata, Lipno 5' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const z = await prisma.servisniZakazka.findUniqueOrThrow({ where: { id: res.data.id } })
    expect(z.adresaZasahu).toBe('Chata, Lipno 5')
  })

  it('nové zařízení vznikne ve stejné transakci, patří klientovi a má QR token', async () => {
    const res = await createServisniZakazka(orgId, {
      klientId,
      typ: 'UVEDENI_DO_PROVOZU',
      popis: 'Nová klima',
      noveZarizeni: { nazev: 'Daikin Perfera', typ: 'KLIMATIZACE', vyrobniCislo: ' SN123 ' },
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const z = await prisma.servisniZakazka.findUniqueOrThrow({ where: { id: res.data.id }, include: { zarizeni: true } })
    expect(z.zarizeni).not.toBeNull()
    expect(z.zarizeni!.orgId).toBe(orgId)
    expect(z.zarizeni!.klientId).toBe(klientId)
    expect(z.zarizeni!.typ).toBe('KLIMATIZACE')
    expect(z.zarizeni!.vyrobniCislo).toBe('SN123')
    expect(z.zarizeni!.qrToken).toBeTruthy()
  })

  it('vybrané zařízení určí klienta i aktivní kontrakt', async () => {
    const res = await createServisniZakazka(orgId, { zarizeniId: zarizeniSKontraktemId, typ: 'PORUCHA', popis: 'hluk' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const z = await prisma.servisniZakazka.findUniqueOrThrow({ where: { id: res.data.id } })
    expect(z.klientId).toBe(klientId)
    expect(z.kontraktId).toBe(kontraktId)
  })

  it('validace: nové zařízení bez klienta, nové + existující zároveň, neplatná priorita', async () => {
    const a = await createServisniZakazka(orgId, { noveZarizeni: { nazev: 'X' } })
    expect(a.ok).toBe(false)
    const b = await createServisniZakazka(orgId, { klientId, zarizeniId: zarizeniSKontraktemId, noveZarizeni: { nazev: 'X' } })
    expect(b.ok).toBe(false)
    const c = await createServisniZakazka(orgId, { klientId, priorita: 'HORI' })
    expect(c.ok).toBe(false)
    const d = await createServisniZakazka(orgId, { klientId, noveZarizeni: { nazev: '   ' } })
    expect(d.ok).toBe(false)
  })

  it('tenant guard: klient ani zařízení cizí org neprojdou', async () => {
    const a = await createServisniZakazka(orgId, { klientId: ciziKlientId, popis: 'x' })
    expect(a.ok).toBe(false)
    if (!a.ok) expect(a.status).toBe(400)
    const b = await createServisniZakazka(ciziOrgId, { zarizeniId: zarizeniSKontraktemId })
    expect(b.ok).toBe(false)
    // nic se v cizí org nezaložilo
    expect(await prisma.servisniZakazka.count({ where: { orgId: ciziOrgId } })).toBe(0)
    expect(await prisma.zarizeni.count({ where: { orgId: ciziOrgId } })).toBe(0)
  })
})

describe('updateServisniZakazka — zadání', () => {
  it('PATCH mění popis/prioritu/adresu/kontakt, prázdný řetězec vyprázdní, neplatná priorita = 400', async () => {
    const created = await createServisniZakazka(orgId, { klientId, popis: 'původní', priorita: 'BEZNA' })
    if (!created.ok) throw new Error(created.error)
    const ok = await updateServisniZakazka(orgId, created.data.id, {
      popis: 'nový popis',
      priorita: 'URGENTNI',
      adresaZasahu: '',
      kontaktJmeno: 'Karel',
    })
    expect(ok.ok).toBe(true)
    const z = await prisma.servisniZakazka.findUniqueOrThrow({ where: { id: created.data.id } })
    expect(z.popis).toBe('nový popis')
    expect(z.priorita).toBe('URGENTNI')
    expect(z.adresaZasahu).toBeNull()
    expect(z.kontaktJmeno).toBe('Karel')

    const bad = await updateServisniZakazka(orgId, created.data.id, { priorita: 'HORI' })
    expect(bad.ok).toBe(false)
  })
})

describe('pohledy nad zakázkami (lib/servisStav)', async () => {
  const { jeAktualni, jeBudouciPlanovana, jeReaktivni, SERVIS_HORIZONT_DNI } = await import('@/lib/servisStav')
  const now = new Date('2026-09-20T10:00:00Z')
  const den = 86_400_000
  const smluvni = (dni: number, stav = 'NAPLANOVANA') => ({
    stav, typ: 'PLANOVANY_SERVIS', kontraktId: 'k1', planovanyTermin: new Date(now.getTime() + dni * den),
  })

  it('reaktivní = porucha nebo bez kontraktu, ne rutinní smluvní návštěva', () => {
    expect(jeReaktivni({ typ: 'PORUCHA', kontraktId: 'k1' })).toBe(true)
    expect(jeReaktivni({ typ: 'PLANOVANY_SERVIS', kontraktId: null })).toBe(true)
    expect(jeReaktivni({ typ: 'PLANOVANY_SERVIS', kontraktId: 'k1' })).toBe(false)
  })

  it('aktuální: reaktivní vždy, smluvní jen do horizontu, hotové nikdy', () => {
    expect(jeAktualni({ stav: 'NOVA', typ: 'PORUCHA', kontraktId: null, planovanyTermin: null }, now)).toBe(true)
    expect(jeAktualni(smluvni(10), now)).toBe(true)
    expect(jeAktualni(smluvni(SERVIS_HORIZONT_DNI + 1), now)).toBe(false)
    expect(jeAktualni(smluvni(400), now)).toBe(false)
    expect(jeAktualni({ stav: 'DOKONCENA', typ: 'PORUCHA', kontraktId: null, planovanyTermin: null }, now)).toBe(false)
  })

  it('budoucí plánovaná = smluvní za horizontem; reaktivní ani blízké tam nepatří', () => {
    expect(jeBudouciPlanovana(smluvni(400), now)).toBe(true)
    expect(jeBudouciPlanovana(smluvni(10), now)).toBe(false)
    expect(jeBudouciPlanovana({ ...smluvni(400), typ: 'PORUCHA' }, now)).toBe(false)
    expect(jeBudouciPlanovana({ ...smluvni(400), stav: 'DOKONCENA' }, now)).toBe(false)
  })
})
