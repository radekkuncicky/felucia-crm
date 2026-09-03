import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { rm } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { getServerSession } from 'next-auth'
import { POST as pripadyPost, GET as pripadyGet } from '@/app/api/mobile/obchod/pripady/route'
import { POST as stavPost } from '@/app/api/mobile/obchod/pripady/[id]/stav/route'
import { POST as zamereniPost } from '@/app/api/mobile/obchod/pripady/[id]/zamereni/route'
import { PATCH as zamereniPatch } from '@/app/api/mobile/obchod/zamereni/[id]/route'
import { POST as uzavritPost } from '@/app/api/mobile/obchod/zamereni/[id]/uzavrit/route'
import { POST as fotoPost } from '@/app/api/mobile/obchod/zamereni/[id]/foto/route'
import { POST as nabidkaPost } from '@/app/api/mobile/obchod/pripady/[id]/nabidka/route'
import { PATCH as nabidkaPatch } from '@/app/api/mobile/obchod/nabidka/[id]/route'
import { POST as sodPost } from '@/app/api/mobile/obchod/pripady/[id]/sod/route'
import { POST as sodPodepsatPost } from '@/app/api/mobile/obchod/sod/[id]/podepsat/route'
import { quoteCelkemBezDph, quoteCelkemSDph } from '@/lib/quoteMath'
import { sweepNabidkyFollowUp, FOLLOWUP_PO_DNECH } from '@/worker/followupy'

const RUN = `obchod-${Date.now()}`

let orgId: string
let userId: string
let dealId: string
let zamereniId: string

const jsonReq = (method: string, body?: unknown) =>
  new Request('http://localhost/api/mobile/obchod/test', {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

function mockRole(role: 'ADMIN' | 'OBCHODNIK' | 'TECHNIK') {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: userId, orgId, role, plan: 'PROFESSIONAL' },
  } as never)
}

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: { nazev: 'Test Obchod', slug: RUN, plan: 'PROFESSIONAL' },
  })
  orgId = org.id
  const user = await prisma.user.create({
    data: { orgId, jmeno: 'Oto Obchodník', email: `oto-${RUN}@example.cz`, role: 'OBCHODNIK', hesloHash: 'x' },
  })
  userId = user.id
  mockRole('OBCHODNIK')
})

afterAll(async () => {
  if (zamereniId) {
    await rm(join(process.cwd(), 'public', 'uploads', 'zamereni', zamereniId), { recursive: true, force: true }).catch(() => {})
  }
  await prisma.sod.deleteMany({ where: { orgId } })
  await prisma.zakazka.deleteMany({ where: { orgId } })
  await prisma.zarizeni.deleteMany({ where: { orgId } })
  await prisma.deal.deleteMany({ where: { orgId } })
  await prisma.zamereniDefinice.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.notification.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.orgSettings.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
  await prisma.$disconnect()
})

describe('výpočty nabídky', () => {
  it('položková sleva v % a součty s DPH', () => {
    const items = [
      { mnozstvi: 2, cenaZaKus: 1000, sleva: 10 }, // 1800
      { mnozstvi: 1, cenaZaKus: 500, sleva: 0 },   // 500
      { mnozstvi: 1, cenaZaKus: -300, sleva: 0 },  // celková sleva v Kč jako záporný řádek
    ]
    expect(quoteCelkemBezDph(items)).toBe(2000)
    expect(quoteCelkemSDph(items, 21)).toBeCloseTo(2420)
    expect(quoteCelkemSDph(items, 12)).toBeCloseTo(2240)
  })
})

describe('případy', () => {
  it('TECHNIK nemá do obchodního API přístup', async () => {
    mockRole('TECHNIK')
    const res = await pripadyGet(jsonReq('GET'))
    expect(res.status).toBe(403)
    mockRole('OBCHODNIK')
  })

  it('vytvoření případu s novým klientem inline', async () => {
    const res = await pripadyPost(jsonReq('POST', {
      technologie: 'TEPELNE_CERPADLO',
      predmet: 'TČ pro RD',
      adresaDila: 'Testovací 12, Ostrava',
      klient: { jmeno: 'Karel', prijmeni: 'Zkouška', telefon: '601123456', typKlienta: 'FYZICKA_OSOBA' },
    }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.kod).toMatch(/^OP-\d{2}-\d{3}$/)
    dealId = data.id
  })

  it('seznam vrací nový případ včetně klienta a stavu zaměření', async () => {
    const res = await pripadyGet(jsonReq('GET'))
    const list = await res.json()
    const muj = list.find((d: { id: string }) => d.id === dealId)
    expect(muj).toBeTruthy()
    expect(muj.klient.jmeno).toBe('Karel Zkouška')
    expect(muj.stav).toBe('NOVY')
    expect(muj.zamereni).toEqual({ celkem: 0, uzavrena: 0 })
  })

  it('prohra bez důvodu se odmítne, s důvodem projde a zapíše audit', async () => {
    const bez = await stavPost(jsonReq('POST', { stav: 'PAS' }), { params: { id: dealId } })
    expect(bez.status).toBe(400)

    const s = await stavPost(
      jsonReq('POST', { stav: 'PAS', duvodProhryKod: 'CENA', duvodProhry: 'moc drahé' }),
      { params: { id: dealId } },
    )
    expect(s.status).toBe(200)
    const deal = await prisma.deal.findUnique({ where: { id: dealId } })
    expect(deal?.stav).toBe('PAS')
    expect(deal?.duvodProhryKod).toBe('CENA')

    const audit = await prisma.auditLog.findFirst({
      where: { orgId, typZaznamu: 'Deal', zaznamId: dealId, typAkce: 'UPDATE' },
      orderBy: { vytvoreno: 'desc' },
    })
    expect(audit).toBeTruthy()
    expect((audit!.zmeny as { stav: { na: string } }).stav.na).toBe('PAS')

    // návrat do jednání smaže důvod prohry
    await stavPost(jsonReq('POST', { stav: 'JEDNANI' }), { params: { id: dealId } })
    const zpet = await prisma.deal.findUnique({ where: { id: dealId } })
    expect(zpet?.duvodProhryKod).toBeNull()
  })

  it('neplatný stav (ZNEPLATNENO z mobilu) se odmítne', async () => {
    const res = await stavPost(jsonReq('POST', { stav: 'ZNEPLATNENO' }), { params: { id: dealId } })
    expect(res.status).toBe(400)
  })
})

describe('zaměření', () => {
  it('založení předvyplní adresu a zafixuje výchozí definici', async () => {
    const res = await zamereniPost(jsonReq('POST', { gpsLat: 49.8, gpsLng: 18.2 }), { params: { id: dealId } })
    expect(res.status).toBe(201)
    const data = await res.json()
    zamereniId = data.id
    expect(data.typ).toBe('TEPELNE_CERPADLO')
    expect(data.definice.verze).toBe(0) // default z kódu

    const z = await prisma.zamereni.findUnique({ where: { id: zamereniId } })
    expect((z?.odpovedi as { adresa: string }).adresa).toBe('Testovací 12, Ostrava')
  })

  it('uzavření nekompletního zaměření vrátí checklist chybějícího', async () => {
    const res = await uzavritPost(jsonReq('POST'), { params: { id: zamereniId } })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.chybejiciOtazky.length).toBeGreaterThan(0)
    expect(data.chybejiciTagy).toContain('ROZVADEC')
  })

  it('upload fotky přes multipart uloží tag a GPS', async () => {
    const fd = new FormData()
    fd.append('foto', new File([Buffer.from('fake-jpeg')], 'a.jpg', { type: 'image/jpeg' }))
    fd.append('tag', 'ROZVADEC')
    fd.append('gpsLat', '49.8')
    const req = new Request('http://localhost/x', { method: 'POST', body: fd })
    const res = await fotoPost(req, { params: { id: zamereniId } })
    expect(res.status).toBe(201)
    const { fotky } = await res.json()
    expect(fotky).toHaveLength(1)
    expect(fotky[0].tag).toBe('ROZVADEC')
  })

  it('po vyplnění povinných polí a tagů jde zaměření uzavřít a je zamčené', async () => {
    // zbylé povinné tagy doplníme přímo (multipart už je otestovaný)
    for (const tag of ['STAVAJICI_ZDROJ', 'VENKOVNI_JEDNOTKA', 'CELKOVY_POHLED'] as const) {
      await prisma.zamereniFoto.create({
        data: { orgId, zamereniId, url: `/uploads/zamereni/${zamereniId}/${tag}.jpg`, tag },
      })
    }
    const odpovedi = {
      stavajici_zdroj: 'Plynový kotel',
      jistic: '25 A',
      pocet_fazi: '3',
      stav_rozvadece: 'Vyhovující',
      vytapena_plocha: 140,
      otopna_soustava: 'Radiátory',
      ohrev_tuv: true,
      objem_zasobniku: 200,
      umisteni_vj: 'Za domem',
      delka_trasy: 8,
    }
    const patchRes = await zamereniPatch(jsonReq('PATCH', { odpovedi }), { params: { id: zamereniId } })
    expect(patchRes.status).toBe(200)

    const res = await uzavritPost(jsonReq('POST'), { params: { id: zamereniId } })
    expect(res.status).toBe(200)

    const znovu = await zamereniPatch(jsonReq('PATCH', { odpovedi: { adresa: 'x' } }), { params: { id: zamereniId } })
    expect(znovu.status).toBe(409)
  })

  it('podmíněná povinnost: objem zásobníku se nevyžaduje bez ohřevu TUV', async () => {
    const res = await zamereniPost(jsonReq('POST', {}), { params: { id: dealId } })
    const { id } = await res.json()
    await zamereniPatch(jsonReq('PATCH', {
      odpovedi: {
        adresa: 'a', stavajici_zdroj: 'Žádný', jistic: '25 A', pocet_fazi: '1',
        stav_rozvadece: 'Vyhovující', vytapena_plocha: 100, otopna_soustava: 'Kombinace',
        ohrev_tuv: false, umisteni_vj: 'x', delka_trasy: 5,
      },
    }), { params: { id } })
    const uz = await uzavritPost(jsonReq('POST'), { params: { id } })
    const data = await uz.json()
    // chybí jen fotky, žádné otázky
    expect(uz.status).toBe(400)
    expect(data.chybejiciOtazky).toEqual([])
    await prisma.zamereni.delete({ where: { id } })
  })
})

describe('nabídky', () => {
  let nabidkaAId: string
  let nabidkaBId: string

  it('první varianta je rovnou aktivní a spočítá součty', async () => {
    const res = await nabidkaPost(jsonReq('POST', {
      nazev: 'Základ',
      dphSazba: 12,
      items: [
        { nazev: 'TČ 8 kW', mnozstvi: 1, cenaZaKus: 200000, sleva: 5 },
        { nazev: 'Montáž', mnozstvi: 10, cenaZaKus: 1500 },
        { nazev: 'Sleva za akci', mnozstvi: 1, cenaZaKus: -5000 },
      ],
    }), { params: { id: dealId } })
    expect(res.status).toBe(201)
    const data = await res.json()
    nabidkaAId = data.id
    expect(data.aktivni).toBe(true)
    expect(data.celkemBezDph).toBe(200000)
  })

  it('druhá varianta aktivní není; aktivace přepne sourozence', async () => {
    const res = await nabidkaPost(jsonReq('POST', {
      nazev: 'Doporučeno',
      dphSazba: 12,
      items: [{ nazev: 'TČ 12 kW', mnozstvi: 1, cenaZaKus: 260000 }],
    }), { params: { id: dealId } })
    const data = await res.json()
    nabidkaBId = data.id
    expect(data.aktivni).toBe(false)

    const patch = await nabidkaPatch(jsonReq('PATCH', { aktivni: true }), { params: { id: nabidkaBId } })
    expect(patch.status).toBe(200)
    const a = await prisma.quote.findUnique({ where: { id: nabidkaAId } })
    const b = await prisma.quote.findUnique({ where: { id: nabidkaBId } })
    expect(a?.aktivni).toBe(false)
    expect(b?.aktivni).toBe(true)
  })

  it('validace: záporná cena u katalogové položky a špatná DPH se odmítnou', async () => {
    const produkt = await prisma.product.create({
      data: { orgId, nazev: 'Katalogový produkt', standardniCena: 100 },
    })
    const zaporna = await nabidkaPost(jsonReq('POST', {
      items: [{ productId: produkt.id, nazev: 'X', mnozstvi: 1, cenaZaKus: -1 }],
    }), { params: { id: dealId } })
    expect(zaporna.status).toBe(400)

    const dph = await nabidkaPost(jsonReq('POST', {
      dphSazba: 15,
      items: [{ nazev: 'X', mnozstvi: 1, cenaZaKus: 1 }],
    }), { params: { id: dealId } })
    expect(dph.status).toBe(400)
    await prisma.product.delete({ where: { id: produkt.id } })
  })

  it('SOD z varianty: aktivuje ji a převezme ceny', async () => {
    const res = await sodPost(jsonReq('POST', { quoteId: nabidkaAId, typ: 'DPH_12_SE_ZALOHOU' }), { params: { id: dealId } })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.cislo).toBeTruthy()
    expect(data.cenaBezDph).toBe(200000)
    expect(data.cenaSDph).toBe(224000)

    const a = await prisma.quote.findUnique({ where: { id: nabidkaAId } })
    expect(a?.aktivni).toBe(true)
  })
})

describe('podpis smlouvy na místě', () => {
  const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><path d="M10,10 L100,50" stroke="#000" fill="none"/></svg>'

  it('bez souhlasu se odmítne', async () => {
    const sod = await prisma.sod.findFirst({ where: { dealId, orgId } })
    const res = await sodPodepsatPost(
      jsonReq('POST', { podpisSvg: SVG, jmeno: 'Klára Klientová' }),
      { params: { id: sod!.id } },
    )
    expect(res.status).toBe(422)
  })

  it('neplatný formát podpisu se odmítne', async () => {
    const sod = await prisma.sod.findFirst({ where: { dealId, orgId } })
    const res = await sodPodepsatPost(
      jsonReq('POST', { podpisSvg: 'javascript:alert(1)', jmeno: 'Klára', souhlas: true }),
      { params: { id: sod!.id } },
    )
    expect(res.status).toBe(422)
  })

  it('podpis uloží snapshot verze a OP převede na USPECH se zakázkou', async () => {
    const sod = await prisma.sod.findFirst({ where: { dealId, orgId } })
    const res = await sodPodepsatPost(
      jsonReq('POST', { podpisSvg: SVG, jmeno: 'Klára Klientová', souhlas: true }),
      { params: { id: sod!.id } },
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.stav).toBe('PODEPSANO')
    expect(data.dealStav).toBe('USPECH')
    expect(data.zakazkaId).toBeTruthy()

    const po = await prisma.sod.findUnique({ where: { id: sod!.id } })
    expect(po?.stav).toBe('PODEPSANO')
    expect(po?.podepsalJmeno).toBe('Klára Klientová')
    expect(po?.podpisSvg?.startsWith('data:image/svg+xml;base64,')).toBe(true)
    expect(po?.podpisTextHash).toBeTruthy()

    // Snapshot podepsané verze přes relaci PODEPSANA — z něj se renderuje podepsané PDF
    const relace = await prisma.sodPodpisRelace.findFirst({ where: { sodId: sod!.id, stav: 'PODEPSANA' } })
    expect(relace?.verzeId).toBeTruthy()

    const deal = await prisma.deal.findUnique({ where: { id: dealId } })
    expect(deal?.stav).toBe('USPECH')
    const zakazka = await prisma.zakazka.findFirst({ where: { opId: dealId, orgId } })
    expect(zakazka?.id).toBe(data.zakazkaId)
    // Položky zakázky převzaté z aktivní nabídky
    const polozky = await prisma.zakazkaPolozka.findMany({ where: { zakazkaId: zakazka!.id } })
    expect(polozky.length).toBeGreaterThan(0)
  })

  it('opakovaný podpis se odmítne', async () => {
    const sod = await prisma.sod.findFirst({ where: { dealId, orgId } })
    const res = await sodPodepsatPost(
      jsonReq('POST', { podpisSvg: SVG, jmeno: 'Klára', souhlas: true }),
      { params: { id: sod!.id } },
    )
    expect(res.status).toBe(422)
  })
})

describe('follow-up odeslaných nabídek (worker)', () => {
  it('nabídka bez reakce → jednorázový bell obchodníkovi, uzavřené OP se přeskočí', async () => {
    const klient = await prisma.client.create({
      data: { orgId, jmeno: 'Fero', prijmeni: 'Followupový' },
    })
    const staraOdeslana = new Date(Date.now() - (FOLLOWUP_PO_DNECH + 1) * 24 * 3600_000)

    // OP v NABÍDKA s nabídkou odeslanou před 4 dny → follow-up
    const deal = await prisma.deal.create({
      data: { orgId, clientId: klient.id, userId, stav: 'NABIDKA', technologie: 'KLIMA', kod: `OP-F-${RUN}` },
    })
    const quote = await prisma.quote.create({
      data: { orgId, dealId: deal.id, nazev: 'K follow-upu', odeslanoAt: staraOdeslana, odeslanoKanal: 'EMAIL' },
    })
    // OP vyhraný — follow-up nedává smysl
    const dealUspech = await prisma.deal.create({
      data: { orgId, clientId: klient.id, userId, stav: 'USPECH', technologie: 'KLIMA', kod: `OP-FU-${RUN}` },
    })
    await prisma.quote.create({
      data: { orgId, dealId: dealUspech.id, nazev: 'Vyhraná', odeslanoAt: staraOdeslana, odeslanoKanal: 'EMAIL' },
    })
    // Čerstvě odeslaná — ještě ne
    await prisma.quote.create({
      data: { orgId, dealId: deal.id, nazev: 'Čerstvá', odeslanoAt: new Date(), odeslanoKanal: 'SMS' },
    })

    expect(await sweepNabidkyFollowUp(prisma)).toBe(1)

    const po = await prisma.quote.findUnique({ where: { id: quote.id } })
    expect(po?.followUpAt).toBeTruthy()
    const notifikace = await prisma.notification.findFirst({
      where: { orgId, userId, typ: 'NABIDKA_FOLLOWUP', dealId: deal.id },
    })
    expect(notifikace?.zprava).toContain('bez reakce')

    // Druhý průchod už nic neposílá (followUpAt značka)
    expect(await sweepNabidkyFollowUp(prisma)).toBe(0)
  })
})
