import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { POST as etapyPost } from '@/app/api/zakazky/[id]/etapy/route'
import { POST as predavakyPost } from '@/app/api/predavaky/route'
import { POST as schvalitPost } from '@/app/api/predavaky/[id]/schvalit/route'
import { PATCH as predavakPatch } from '@/app/api/predavaky/[id]/route'
import { POST as vyuSchvalitPost } from '@/app/api/vyuctovani/[id]/schvalit/route'
import { POST as mobilePredavakPost } from '@/app/api/mobile/zakazka/[id]/predavak/route'
import { getServerSession } from 'next-auth'

const RUN = `etapy-gating-${Date.now()}`

let orgId: string
let adminId: string
let zakazkaId: string

function loginAsAdmin() {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: adminId, orgId, role: 'ADMIN' } } as never)
}

function postEtapa(zakId: string, body: Record<string, unknown> = {}) {
  return etapyPost(new Request('http://test', { method: 'POST', body: JSON.stringify(body) }), { params: { id: zakId } })
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test Etapy Gating', slug: RUN } })
  orgId = org.id
  const admin = await prisma.user.create({
    data: { orgId, jmeno: 'Vedoucí Admin', email: `${RUN}-admin@example.com`, hesloHash: 'x', role: 'ADMIN' },
  })
  adminId = admin.id
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Klient' } })
  const zakazka = await prisma.zakazka.create({
    data: {
      orgId, cislo: `${RUN}-ZAK-001`, nazev: 'Vícetapová zakázka', klientId: klient.id, vedouciId: adminId,
      stav: 'V_REALIZACI',
      polozky: { create: [{ nazev: 'Jednotka', mnozstvi: 1, jednotka: 'ks', prodejniCena: 50000, dphSazba: 12, poradi: 0 }] },
    },
  })
  zakazkaId = zakazka.id
  loginAsAdmin()
})

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.vyuctovaniPolozka.deleteMany({ where: { vyuctovani: { orgId } } })
  await prisma.vyuctovani.deleteMany({ where: { orgId } })
  await prisma.predavakPolozka.deleteMany({ where: { predavak: { orgId } } })
  await prisma.predavak.deleteMany({ where: { orgId } })
  await prisma.notification.deleteMany({ where: { orgId } })
  await prisma.skladPohyb.deleteMany({ where: { orgId } })
  await prisma.zakazkaEtapa.deleteMany({ where: { orgId } })
  await prisma.zakazkaPolozka.deleteMany({ where: { zakazka: { orgId } } })
  await prisma.zakazka.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
})

describe('lineární etapy — přidání další etapy je zablokované, dokud předchozí není vyúčtovaná', () => {
  it('první etapu lze založit vždy', async () => {
    const res = await postEtapa(zakazkaId, { nazev: 'Etapa 1' })
    expect(res.status).toBe(201)
  })

  it('druhou etapu nejde přidat, dokud první nemá schválený protokol ani vyúčtování', async () => {
    const res = await postEtapa(zakazkaId, { nazev: 'Etapa 2' })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toMatch(/dokončit/i)
    expect(await prisma.zakazkaEtapa.count({ where: { zakazkaId } })).toBe(1)
  })

  it('ani se schváleným protokolem (bez schváleného vyúčtování) druhá etapa nejde', async () => {
    const etapa1 = await prisma.zakazkaEtapa.findFirstOrThrow({ where: { zakazkaId, cislo: 1 } })
    const p = await predavakyPost(new Request('http://test/api/predavaky', {
      method: 'POST', body: JSON.stringify({ zakazkaId, etapaId: etapa1.id }),
    }))
    const predavak = await p.json()
    await prisma.predavak.update({ where: { id: predavak.id }, data: { stav: 'PODPISAN', podpisano: new Date() } })
    const schval = await schvalitPost(new Request('http://test'), { params: { id: predavak.id } })
    expect(schval.status).toBe(200)
    const { vyuctovaniId } = await schval.json()

    const res = await postEtapa(zakazkaId, { nazev: 'Etapa 2' })
    expect(res.status).toBe(422)
    expect(await prisma.zakazkaEtapa.count({ where: { zakazkaId } })).toBe(1)

    // schválíme i vyúčtování pro navazující test
    const vyuSchval = await vyuSchvalitPost(new Request('http://test'), { params: { id: vyuctovaniId } })
    expect(vyuSchval.status).toBe(200)
  })

  it('jakmile je vyúčtování etapy 1 schválené, druhou etapu lze přidat a zakázka se vrátí do realizace', async () => {
    // po schválení vyúčtování je zakázka VYUCTOVANA
    const pred = await prisma.zakazka.findUniqueOrThrow({ where: { id: zakazkaId } })
    expect(pred.stav).toBe('VYUCTOVANA')

    const res = await postEtapa(zakazkaId, { nazev: 'Etapa 2' })
    expect(res.status).toBe(201)
    const etapa2 = await res.json()
    expect(etapa2.cislo).toBe(2)

    // nová etapa začíná stejně jako předtím — zakázka zpět V_REALIZACI, ne „hotová"
    const po = await prisma.zakazka.findUniqueOrThrow({ where: { id: zakazkaId } })
    expect(po.stav).toBe('V_REALIZACI')
  })

  it('třetí etapu zase nejde přidat, dokud druhá není vyúčtovaná', async () => {
    const res = await postEtapa(zakazkaId, { nazev: 'Etapa 3' })
    expect(res.status).toBe(422)
    expect(await prisma.zakazkaEtapa.count({ where: { zakazkaId } })).toBe(2)
  })
})

describe('schválení vyúčtování s volbou zahájit další etapu', () => {
  it('schválí vyúčtování etapy 2, založí etapu 3 a zakázku vrátí do realizace jedním požadavkem', async () => {
    // dokončení etapy 2: protokol → podpis → schválení (auto-vznik vyúčtování s vazbou na etapu)
    const etapa2 = await prisma.zakazkaEtapa.findFirstOrThrow({ where: { zakazkaId, cislo: 2 } })
    const p = await predavakyPost(new Request('http://test/api/predavaky', {
      method: 'POST', body: JSON.stringify({ zakazkaId, etapaId: etapa2.id }),
    }))
    const predavak = await p.json()
    await prisma.predavak.update({ where: { id: predavak.id }, data: { stav: 'PODPISAN', podpisano: new Date() } })
    const schval = await schvalitPost(new Request('http://test'), { params: { id: predavak.id } })
    expect(schval.status).toBe(200)
    const { vyuctovaniId } = await schval.json()

    const res = await vyuSchvalitPost(new Request('http://test', {
      method: 'POST', body: JSON.stringify({ zahajitDalsiEtapu: true }),
    }), { params: { id: vyuctovaniId } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.dalsiEtapa?.cislo).toBe(3)
    expect(body.dalsiEtapaChyba).toBeNull()
    expect(body.zakazkaNovyStav).toBe('V_REALIZACI')

    const etapa3 = await prisma.zakazkaEtapa.findFirst({ where: { zakazkaId, cislo: 3 } })
    expect(etapa3?.stav).toBe('PLANOVANA')
    const zak = await prisma.zakazka.findUniqueOrThrow({ where: { id: zakazkaId } })
    expect(zak.stav).toBe('V_REALIZACI')
  })

  it('když gating další etapu nepustí, vyúčtování se přesto schválí a chyba se jen vrátí v odpovědi', async () => {
    // etapa 3 je čerstvě založená (nekompletní) — další etapa nejde, ale schválení projde
    const v = await prisma.vyuctovani.create({
      data: { orgId, zakazkaId, cislo: `${RUN}-VYU-EXTRA`, stav: 'NAVRH' },
    })
    const res = await vyuSchvalitPost(new Request('http://test', {
      method: 'POST', body: JSON.stringify({ zahajitDalsiEtapu: true }),
    }), { params: { id: v.id } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.dalsiEtapa).toBeNull()
    expect(body.dalsiEtapaChyba).toMatch(/dokončit/i)

    const po = await prisma.vyuctovani.findUniqueOrThrow({ where: { id: v.id } })
    expect(po.stav).toBe('SCHVALENO')
    expect(await prisma.zakazkaEtapa.count({ where: { zakazkaId } })).toBe(3)
  })
})

describe('mobilní protokol se automaticky zařadí do otevřené etapy', () => {
  it('protokol založený přes mobilní API dostane etapaId poslední nepředané etapy', async () => {
    const etapa3 = await prisma.zakazkaEtapa.findFirstOrThrow({ where: { zakazkaId, cislo: 3 } })
    const res = await mobilePredavakPost(
      new Request('http://test/api/mobile/zakazka/x/predavak', { method: 'POST' }),
      { params: { id: zakazkaId } },
    )
    expect(res.status).toBe(201)
    const { id } = await res.json()
    const predavak = await prisma.predavak.findUniqueOrThrow({ where: { id } })
    expect(predavak.etapaId).toBe(etapa3.id)
  })
})

describe('souběžné založení první etapy (dvojklik) nespadne jako neošetřená chyba', () => {
  it('dva souběžné požadavky — jeden uspěje (cislo 1), druhý dostane čistou 422 odpověď, ne pád', async () => {
    const klient = await prisma.client.create({ data: { orgId, jmeno: 'Souběžný', prijmeni: 'Klient' } })
    const zakazka = await prisma.zakazka.create({
      data: { orgId, cislo: `${RUN}-ZAK-RACE`, nazev: 'Souběžná zakázka', klientId: klient.id, stav: 'V_REALIZACI' },
    })

    const [res1, res2] = await Promise.all([
      postEtapa(zakazka.id, { nazev: 'Etapa A' }),
      postEtapa(zakazka.id, { nazev: 'Etapa B' }),
    ])

    const statuses = [res1.status, res2.status].sort()
    // Buď oba uspějí (retry doplní druhé číslo), nebo druhý narazí na gating
    // (etapa 1 čerstvě založená ještě není hotová) — v obou případech čistá
    // JSON odpověď, nikdy nezachycená výjimka / prázdné tělo.
    expect(statuses[0]).toBe(201)
    expect([201, 422]).toContain(statuses[1])

    const bodies = await Promise.all([res1.json(), res2.json()])
    for (const b of bodies) {
      expect(b).not.toBeNull()
      expect(typeof b).toBe('object')
    }

    const pocetEtap = await prisma.zakazkaEtapa.count({ where: { zakazkaId: zakazka.id } })
    expect(pocetEtap).toBe(statuses[1] === 201 ? 2 : 1)
  })
})

describe('rozdělení na etapy u zakázky, která už má předávák a vyúčtování', () => {
  let n = 0
  async function zakazkaSPraci(vyuctovaniSchvalit: boolean) {
    n++
    const klient = await prisma.client.create({ data: { orgId, jmeno: 'Jednofázový', prijmeni: `Klient ${n}` } })
    const zakazka = await prisma.zakazka.create({
      data: {
        orgId, cislo: `${RUN}-ZAK-ADOPT-${n}`, nazev: 'Bez etap', klientId: klient.id, vedouciId: adminId,
        stav: 'V_REALIZACI',
        polozky: { create: [{ nazev: 'Jednotka', mnozstvi: 1, jednotka: 'ks', prodejniCena: 30000, dphSazba: 12, poradi: 0 }] },
      },
    })
    const p = await predavakyPost(new Request('http://test/api/predavaky', {
      method: 'POST', body: JSON.stringify({ zakazkaId: zakazka.id }),
    }))
    const predavak = await p.json()
    await prisma.predavak.update({ where: { id: predavak.id }, data: { stav: 'PODPISAN', podpisano: new Date() } })
    const schval = await schvalitPost(new Request('http://test'), { params: { id: predavak.id } })
    expect(schval.status).toBe(200)
    const { vyuctovaniId } = await schval.json()
    if (vyuctovaniSchvalit) {
      const r = await vyuSchvalitPost(new Request('http://test'), { params: { id: vyuctovaniId } })
      expect(r.status).toBe(200)
    }
    return { zakazkaId: zakazka.id, predavakId: predavak.id as string, vyuctovaniId: vyuctovaniId as string }
  }

  it('hotová práce se zařadí jako Etapa 1 a nová etapa dostane číslo 2', async () => {
    const z = await zakazkaSPraci(true)
    const res = await postEtapa(z.zakazkaId, { nazev: 'Zprovoznění' })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.cislo).toBe(2)
    expect(body.nazev).toBe('Zprovoznění')
    expect(body.adoptovano).toBe(true)
    expect(body.upozorneni).toBeNull()

    const e1 = await prisma.zakazkaEtapa.findFirstOrThrow({ where: { zakazkaId: z.zakazkaId, cislo: 1 } })
    expect(e1.stav).toBe('PREDANA')
    expect((await prisma.predavak.findUniqueOrThrow({ where: { id: z.predavakId } })).etapaId).toBe(e1.id)
    expect((await prisma.vyuctovani.findUniqueOrThrow({ where: { id: z.vyuctovaniId } })).etapaId).toBe(e1.id)
    expect((await prisma.zakazka.findUniqueOrThrow({ where: { id: z.zakazkaId } })).stav).toBe('V_REALIZACI')
  })

  it('nevyúčtovaná práce se zařadí jako Etapa 1, ale další etapa zatím nevznikne', async () => {
    const z = await zakazkaSPraci(false)
    const res = await postEtapa(z.zakazkaId, { nazev: 'Zprovoznění' })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.cislo).toBe(1)
    expect(body.adoptovano).toBe(true)
    expect(body.upozorneni).toMatch(/Etapa 1/)
    expect(await prisma.zakazkaEtapa.count({ where: { zakazkaId: z.zakazkaId } })).toBe(1)
    expect((await prisma.vyuctovani.findUniqueOrThrow({ where: { id: z.vyuctovaniId } })).etapaId).toBe(body.id)
  })

  it('zakázka bez dokladů dostane prázdnou Etapu 1 jako dřív', async () => {
    const klient = await prisma.client.create({ data: { orgId, jmeno: 'Prázdný', prijmeni: 'Klient' } })
    const zakazka = await prisma.zakazka.create({
      data: { orgId, cislo: `${RUN}-ZAK-PRAZDNA`, nazev: 'Prázdná', klientId: klient.id, stav: 'V_REALIZACI' },
    })
    const res = await postEtapa(zakazka.id, { nazev: 'První' })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.cislo).toBe(1)
    expect(body.adoptovano).toBe(false)
    expect(body.stav).toBe('PLANOVANA')
  })

  it('„Schválit a zahájit další etapu" na zakázce bez etap založí Etapu 1 z práce + Etapu 2', async () => {
    const z = await zakazkaSPraci(false)
    const res = await vyuSchvalitPost(new Request('http://test', {
      method: 'POST', body: JSON.stringify({ zahajitDalsiEtapu: true }),
    }), { params: { id: z.vyuctovaniId } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.dalsiEtapa?.cislo).toBe(2)
    expect(body.dalsiEtapaChyba).toBeNull()
    const e1 = await prisma.zakazkaEtapa.findFirstOrThrow({ where: { zakazkaId: z.zakazkaId, cislo: 1 } })
    expect((await prisma.vyuctovani.findUniqueOrThrow({ where: { id: z.vyuctovaniId } })).etapaId).toBe(e1.id)
  })

  it('přeřazení předáváku do jiné etapy přesune i jeho vyúčtování', async () => {
    const z = await zakazkaSPraci(true)
    await postEtapa(z.zakazkaId, {})
    const e2 = await prisma.zakazkaEtapa.findFirstOrThrow({ where: { zakazkaId: z.zakazkaId, cislo: 2 } })
    const res = await predavakPatch(new Request('http://test', {
      method: 'PATCH', body: JSON.stringify({ etapaId: e2.id }),
    }), { params: { id: z.predavakId } })
    expect(res.status).toBe(200)
    expect((await prisma.vyuctovani.findUniqueOrThrow({ where: { id: z.vyuctovaniId } })).etapaId).toBe(e2.id)
  })
})
