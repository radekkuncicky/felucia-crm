import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { POST as schvalitPost } from '@/app/api/predavaky/[id]/schvalit/route'
import { POST as predavakyPost } from '@/app/api/predavaky/route'
import { POST as vyuctovaniPost } from '@/app/api/zakazky/[id]/vyuctovani/route'
import { PATCH as predavakPatch, DELETE as predavakDelete } from '@/app/api/predavaky/[id]/route'
import { POST as odmitnoutPost } from '@/app/api/predavaky/[id]/odmitnout/route'
import { POST as vyuSchvalitPost } from '@/app/api/vyuctovani/[id]/schvalit/route'
import { PATCH as vyuPatch } from '@/app/api/vyuctovani/[id]/route'
import { getServerSession } from 'next-auth'

const RUN = `pp-schval-${Date.now()}`

let orgId: string
let adminId: string
let obchodnikId: string
let technikId: string
let zakazkaId: string
let etapaId: string
let predavakId: string

function loginAs(userId: string, role: string) {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: userId, orgId, role },
  } as never)
}

async function cekejNaNotifikaci(userId: string, typ: string, maxMs = 2000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const n = await prisma.notification.findFirst({ where: { orgId, userId, typ } })
    if (n) return n
    await new Promise(r => setTimeout(r, 50))
  }
  return null
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test PP schválení', slug: RUN } })
  orgId = org.id
  const admin = await prisma.user.create({
    data: { orgId, jmeno: 'Vedoucí Admin', email: `${RUN}-admin@example.com`, hesloHash: 'x', role: 'ADMIN' },
  })
  adminId = admin.id
  const obchodnik = await prisma.user.create({
    data: { orgId, jmeno: 'Oto Obchodník', email: `${RUN}-obchodnik@example.com`, hesloHash: 'x', role: 'OBCHODNIK' },
  })
  obchodnikId = obchodnik.id
  const technik = await prisma.user.create({
    data: { orgId, jmeno: 'Tonda Technik', email: `${RUN}-technik@example.com`, hesloHash: 'x', role: 'TECHNIK' },
  })
  technikId = technik.id
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Klient' } })
  const zakazka = await prisma.zakazka.create({
    data: {
      orgId,
      cislo: `${RUN}-ZAK-001`,
      nazev: 'Testovací zakázka',
      klientId: klient.id,
      vedouciId: adminId,
      stav: 'V_REALIZACI',
      polozky: {
        create: [
          { nazev: 'Tepelné čerpadlo', mnozstvi: 1, jednotka: 'ks', prodejniCena: 100000, dphSazba: 12, poradi: 0 },
          { nazev: 'Montáž', mnozstvi: 8, jednotka: 'h', prodejniCena: 800, dphSazba: 12, poradi: 1 },
        ],
      },
    },
  })
  zakazkaId = zakazka.id
  const etapa = await prisma.zakazkaEtapa.create({
    data: { orgId, zakazkaId, cislo: 1, nazev: 'Etapa 1' },
  })
  etapaId = etapa.id
})

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { orgId } })
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.vyuctovaniPolozka.deleteMany({ where: { vyuctovani: { orgId } } })
  await prisma.vyuctovani.deleteMany({ where: { orgId } })
  await prisma.predavakPolozka.deleteMany({ where: { predavak: { orgId } } })
  await prisma.predavak.deleteMany({ where: { orgId } })
  await prisma.skladPohyb.deleteMany({ where: { orgId } })
  await prisma.zakazkaEtapa.deleteMany({ where: { orgId } })
  await prisma.zakazkaPolozka.deleteMany({ where: { zakazka: { orgId } } })
  await prisma.zakazka.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
})

describe('předávák → schválení → vyúčtování', () => {
  it('OBCHODNIK smí založit protokol', async () => {
    loginAs(obchodnikId, 'OBCHODNIK')
    const res = await predavakyPost(new Request('http://test/api/predavaky', {
      method: 'POST',
      body: JSON.stringify({ zakazkaId, etapaId }),
    }))
    expect(res.status).toBe(201)
    const p = await res.json()
    predavakId = p.id
    expect(p.etapaId).toBe(etapaId)
    // předvyplněno z položek zakázky
    const polozky = await prisma.predavakPolozka.findMany({ where: { predavakId } })
    expect(polozky.length).toBe(2)
  })

  it('schválení vytvoří vyúčtování s vazbou na protokol a zděděnou etapou', async () => {
    await prisma.predavak.update({ where: { id: predavakId }, data: { stav: 'PODPISAN', podpisano: new Date() } })

    loginAs(adminId, 'ADMIN')
    const res = await schvalitPost(new Request('http://test'), { params: { id: predavakId } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.vyuctovaniId).toBeTruthy()
    expect(data.vyuctovaniCislo).toMatch(/^VYU-/)

    const vyu = await prisma.vyuctovani.findUnique({ where: { id: data.vyuctovaniId } })
    expect(vyu?.predavakId).toBe(predavakId)
    expect(vyu?.etapaId).toBe(etapaId)
    expect(vyu?.stav).toBe('NAVRH')
  })

  it('notifikace o schválení jde technikovi protokolu, ale ne aktérovi (vedoucí schvaloval sám)', async () => {
    // technikem protokolu je obchodník, který ho založil — dostane notifikaci
    const proTechnika = await cekejNaNotifikaci(obchodnikId, 'PREDAVAK_SCHVALEN')
    expect(proTechnika).toBeTruthy()
    // vedoucí (admin) akci sám provedl — "vyúčtování připraveno" si neposílá
    const proVedouciho = await prisma.notification.findFirst({
      where: { orgId, userId: adminId, typ: 'VYUCTOVANI_PRIPRAVENO' },
    })
    expect(proVedouciho).toBeNull()
  })

  it('opakované schválení po vrácení nevytvoří duplicitní vyúčtování', async () => {
    const pred = await prisma.vyuctovani.count({ where: { orgId, predavakId } })
    expect(pred).toBe(1)

    await prisma.predavak.update({ where: { id: predavakId }, data: { stav: 'PODPISAN', schvaleno: null, schvalenoId: null } })
    loginAs(adminId, 'ADMIN')
    const res = await schvalitPost(new Request('http://test'), { params: { id: predavakId } })
    expect(res.status).toBe(200)
    const data = await res.json()

    const count = await prisma.vyuctovani.count({ where: { orgId, zakazkaId } })
    expect(count).toBe(1)
    const vyu = await prisma.vyuctovani.findUnique({ where: { predavakId } })
    expect(data.vyuctovaniId).toBe(vyu?.id)
  })

  it('idempotentní volání na už schválený protokol vrátí odkaz na existující vyúčtování', async () => {
    loginAs(adminId, 'ADMIN')
    const res = await schvalitPost(new Request('http://test'), { params: { id: predavakId } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.alreadyApproved).toBe(true)
    expect(data.vyuctovaniId).toBeTruthy()
  })

  it('ruční generování z protokolu s existujícím vyúčtováním vrátí existující, nezaloží duplicitu', async () => {
    loginAs(adminId, 'ADMIN')
    const existing = await prisma.vyuctovani.findUnique({ where: { predavakId } })
    const res = await vyuctovaniPost(new Request('http://test', {
      method: 'POST',
      body: JSON.stringify({ predavakId }),
    }), { params: { id: zakazkaId } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe(existing?.id)
    expect(await prisma.vyuctovani.count({ where: { orgId, zakazkaId } })).toBe(1)
  })
})

describe('procesní flow — schvalování a vracení stavů', () => {
  let flowPredavakId: string
  // vlastní zakázka — v prvním bloku zůstal schválený protokol, který by posuny stavů držel
  let flowZakazkaId: string

  beforeAll(async () => {
    const klient = await prisma.client.create({ data: { orgId, jmeno: 'Flow', prijmeni: 'Klient' } })
    const z = await prisma.zakazka.create({
      data: {
        orgId,
        cislo: `${RUN}-ZAK-002`,
        nazev: 'Zakázka pro flow',
        klientId: klient.id,
        vedouciId: adminId,
        stav: 'V_REALIZACI',
        polozky: {
          create: [
            { nazev: 'Jednotka', mnozstvi: 1, jednotka: 'ks', prodejniCena: 50000, dphSazba: 12, poradi: 0 },
          ],
        },
      },
    })
    flowZakazkaId = z.id
  })

  async function novyPodepsanyProtokol() {
    loginAs(adminId, 'ADMIN')
    const res = await predavakyPost(new Request('http://test/api/predavaky', {
      method: 'POST',
      body: JSON.stringify({ zakazkaId: flowZakazkaId }),
    }))
    const p = await res.json()
    await prisma.predavak.update({
      where: { id: p.id },
      data: { stav: 'PODPISAN', podpisano: new Date() },
    })
    await prisma.zakazka.update({ where: { id: flowZakazkaId }, data: { stav: 'PREDANA' } })
    return p.id as string
  }

  it('manažer schválí vyúčtování rovnou z návrhu (bez mezistavu ke schválení)', async () => {
    flowPredavakId = await novyPodepsanyProtokol()
    loginAs(adminId, 'ADMIN')
    const schval = await schvalitPost(new Request('http://test'), { params: { id: flowPredavakId } })
    const { vyuctovaniId } = await schval.json()

    const vyu = await prisma.vyuctovani.findUnique({ where: { id: vyuctovaniId } })
    expect(vyu?.stav).toBe('NAVRH')

    loginAs(obchodnikId, 'OBCHODNIK')
    const res = await vyuSchvalitPost(new Request('http://test'), { params: { id: vyuctovaniId } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.zakazkaNovyStav).toBe('VYUCTOVANA')

    const po = await prisma.vyuctovani.findUnique({ where: { id: vyuctovaniId } })
    expect(po?.stav).toBe('SCHVALENO')
    expect(po?.schvalenoId).toBe(obchodnikId)
  })

  it('vrácení schváleného vyúčtování vrátí zakázku z Vyúčtované na Předanou', async () => {
    const vyu = await prisma.vyuctovani.findUnique({ where: { predavakId: flowPredavakId } })
    loginAs(adminId, 'ADMIN')
    const res = await vyuPatch(new Request('http://test', {
      method: 'PATCH',
      body: JSON.stringify({ stav: 'NAVRH' }),
    }), { params: { id: vyu!.id } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.zakazkaNovyStav).toBe('PREDANA')

    const zak = await prisma.zakazka.findUnique({ where: { id: flowZakazkaId } })
    expect(zak?.stav).toBe('PREDANA')
  })

  it('schválený protokol nelze smazat, dokud není vrácen k úpravám', async () => {
    loginAs(adminId, 'ADMIN')
    const res = await predavakDelete(new Request('http://test', { method: 'DELETE' }), { params: { id: flowPredavakId } })
    expect(res.status).toBe(422)
    expect(await prisma.predavak.count({ where: { id: flowPredavakId } })).toBe(1)
  })

  it('vrácení protokolu odčiní schválení: sklad zpět, návrh vyúčtování pryč, zakázka do realizace', async () => {
    // položka vydaná ze skladu při schválení
    const pp = await prisma.predavakPolozka.findFirst({
      where: { predavakId: flowPredavakId, zakazkaPolozkaId: { not: null } },
    })
    await prisma.zakazkaPolozka.update({ where: { id: pp!.zakazkaPolozkaId! }, data: { stav: 'VYDANO' } })

    loginAs(adminId, 'ADMIN')
    const res = await predavakPatch(new Request('http://test', {
      method: 'PATCH',
      body: JSON.stringify({ reopen: true }),
    }), { params: { id: flowPredavakId } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.stav).toBe('ROZPRACOVAN')
    expect(data.zakazkaNovyStav).toBe('V_REALIZACI')

    // vyúčtování z protokolu je pryč, aby se po znovuschválení založilo s aktuálními položkami
    expect(await prisma.vyuctovani.count({ where: { predavakId: flowPredavakId } })).toBe(0)
    // vydaná položka je zpět na skladě a je po ní stopa v pohybech
    const polozka = await prisma.zakazkaPolozka.findUnique({ where: { id: pp!.zakazkaPolozkaId! } })
    expect(polozka?.stav).toBe('NASKLADNENO')
    const storno = await prisma.skladPohyb.findFirst({
      where: { orgId, polozkaId: pp!.zakazkaPolozkaId!, typ: 'STORNO' },
    })
    expect(storno).toBeTruthy()
  })

  it('vrácení protokolu blokuje vyúčtování, které už postoupilo dál než do návrhu', async () => {
    const id = await novyPodepsanyProtokol()
    loginAs(adminId, 'ADMIN')
    const schval = await schvalitPost(new Request('http://test'), { params: { id } })
    const { vyuctovaniId } = await schval.json()
    await prisma.vyuctovani.update({ where: { id: vyuctovaniId }, data: { stav: 'KE_SCHVALENI' } })

    const res = await predavakPatch(new Request('http://test', {
      method: 'PATCH',
      body: JSON.stringify({ reopen: true }),
    }), { params: { id } })
    expect(res.status).toBe(422)
    expect((await res.json()).error).toMatch(/vyúčtování/i)

    const pred = await prisma.predavak.findUnique({ where: { id } })
    expect(pred?.stav).toBe('SCHVALEN')

    // úklid pro další test
    await prisma.vyuctovaniPolozka.deleteMany({ where: { vyuctovaniId } })
    await prisma.vyuctovani.delete({ where: { id: vyuctovaniId } })
    await prisma.predavakPolozka.deleteMany({ where: { predavakId: id } })
    await prisma.predavak.delete({ where: { id } })
  })

  it('odmítnutí posledního podepsaného protokolu vrátí zakázku do realizace', async () => {
    const id = await novyPodepsanyProtokol()
    loginAs(adminId, 'ADMIN')
    const res = await odmitnoutPost(new Request('http://test', {
      method: 'POST',
      body: JSON.stringify({ duvod: 'Chybí fotky' }),
    }), { params: { id } })
    expect(res.status).toBe(200)
    expect((await res.json()).zakazkaNovyStav).toBe('V_REALIZACI')

    const zak = await prisma.zakazka.findUnique({ where: { id: flowZakazkaId } })
    expect(zak?.stav).toBe('V_REALIZACI')
  })

  it('odmítnutí nevrátí zakázku, když na ní visí ještě jiný podepsaný protokol', async () => {
    const zustava = await novyPodepsanyProtokol()
    const odmitany = await novyPodepsanyProtokol()

    loginAs(adminId, 'ADMIN')
    const res = await odmitnoutPost(new Request('http://test', {
      method: 'POST',
      body: JSON.stringify({ duvod: 'Duplicita' }),
    }), { params: { id: odmitany } })
    expect(res.status).toBe(200)
    expect((await res.json()).zakazkaNovyStav).toBeNull()

    const zak = await prisma.zakazka.findUnique({ where: { id: flowZakazkaId } })
    expect(zak?.stav).toBe('PREDANA')

    await prisma.predavakPolozka.deleteMany({ where: { predavakId: zustava } })
    await prisma.predavak.delete({ where: { id: zustava } })
  })
})
