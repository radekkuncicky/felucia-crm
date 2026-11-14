import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { rm } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { getServerSession } from 'next-auth'
import { POST as pripadyPost } from '@/app/api/mobile/obchod/pripady/route'
import { POST as aktivityPost } from '@/app/api/mobile/obchod/aktivity/route'
import { parseMobileId } from '@/lib/mobileIdempotence'
import { GET as fotkyGet, POST as fotkyPost } from '@/app/api/mobile/obchod/pripady/[id]/fotky/route'
import { PATCH as fotkaPatch, DELETE as fotkaDelete } from '@/app/api/mobile/obchod/pripady/[id]/fotky/[fotoId]/route'
import { GET as pripadGet, PATCH as pripadPatch } from '@/app/api/mobile/obchod/pripady/[id]/route'
import { fotoStitkyOrg, VYCHOZI_FOTO_STITKY } from '@/lib/fotoStitky'

/**
 * Přestavba Felucia Sales pro terén: idempotence offline fronty (mobileId),
 * fotky k OP, místo stavby, offline nový OP.
 */

const RUN = `teren-${Date.now()}`

let orgId: string
let userId: string
let dealId: string

const jsonReq = (method: string, body?: unknown) =>
  new Request('http://localhost/api/mobile/obchod/test', {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test Terén', slug: RUN, plan: 'PROFESSIONAL' } })
  orgId = org.id
  const user = await prisma.user.create({
    data: { orgId, jmeno: 'Olga Obchodní', email: `olga-${RUN}@example.cz`, role: 'OBCHODNIK', hesloHash: 'x' },
  })
  userId = user.id
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId, orgId, role: 'OBCHODNIK', plan: 'PROFESSIONAL' } } as never)

  const res = await pripadyPost(jsonReq('POST', {
    klient: { jmeno: 'Karel', prijmeni: 'Terénní', telefon: '+420777100200' },
    technologie: 'TEPELNE_CERPADLO',
  }))
  expect(res.status).toBe(201)
  dealId = (await res.json()).id
})

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)])

function fotoReq(pole: Record<string, string>, obsah: Buffer = JPEG) {
  const fd = new FormData()
  fd.append('foto', new File([new Uint8Array(obsah)], 'f.jpg', { type: 'image/jpeg' }))
  for (const [k, v] of Object.entries(pole)) fd.append(k, v)
  return new Request('http://localhost/api/mobile/obchod/test', { method: 'POST', body: fd })
}

let cizíOrgId: string | null = null

afterAll(async () => {
  if (cizíOrgId) {
    await prisma.user.deleteMany({ where: { orgId: cizíOrgId } })
    await prisma.organization.delete({ where: { id: cizíOrgId } }).catch(() => {})
  }
  await prisma.zamereniFoto.deleteMany({ where: { orgId } })
  await prisma.zamereni.deleteMany({ where: { orgId } })
  if (orgId) await rm(join(process.cwd(), 'public', 'uploads', orgId), { recursive: true, force: true }).catch(() => {})
  await prisma.photo.deleteMany({ where: { orgId } })
  await prisma.activity.deleteMany({ where: { orgId } })
  await prisma.deal.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.notification.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.orgSettings.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
  await prisma.$disconnect()
})

describe('idempotence mobileId', () => {
  it('parseMobileId přijme uuid, odmítne nesmysl', () => {
    expect(parseMobileId('3f0c3a4e-8d2b-4e43-9a51-1b2c3d4e5f60')).toBeTruthy()
    expect(parseMobileId('krátké')).toBeNull()
    expect(parseMobileId(42)).toBeNull()
  })

  it('opakovaný mobileId u aktivity vrátí 200 se stejným záznamem', async () => {
    const mobileId = `akt-${RUN}-1`
    const body = { dealId, typ: 'HOVOR', datum: '2026-11-14', splneno: true, vysledek: 'ok', mobileId }
    const r1 = await aktivityPost(jsonReq('POST', body))
    expect(r1.status).toBe(201)
    const r2 = await aktivityPost(jsonReq('POST', body))
    expect(r2.status).toBe(200)
    expect((await r2.json()).id).toBe((await r1.json()).id)
    expect(await prisma.activity.count({ where: { orgId, mobileId } })).toBe(1)
  })

  it('souběh dvou stejných požadavků založí jen jednu aktivitu (P2002)', async () => {
    const mobileId = `akt-${RUN}-2`
    const body = { dealId, typ: 'POZNAMKA', datum: '2026-11-14', popis: 'souběh', mobileId }
    const [a, b] = await Promise.all([aktivityPost(jsonReq('POST', body)), aktivityPost(jsonReq('POST', body))])
    expect([a.status, b.status].sort()).toEqual([200, 201])
    const [ja, jb] = await Promise.all([a.json(), b.json()])
    expect(ja.id).toBe(jb.id)
    expect(await prisma.activity.count({ where: { orgId, mobileId } })).toBe(1)
  })
})

describe('fotky k OP', () => {
  const p = () => ({ params: { id: dealId } })

  it('upload se štítkem, GPS a mobileId; opakování vrátí 200 bez druhého souboru', async () => {
    const mobileId = `foto-${RUN}-1`
    const r1 = await fotkyPost(fotoReq({ mobileId, tag: 'DUM_ZVENKU', gpsLat: '49.83', gpsLng: '18.29', popis: 'Ulice' }), p())
    expect(r1.status).toBe(201)
    const f1 = await r1.json()
    expect(f1).toMatchObject({ zdroj: 'PRIPAD', tag: 'DUM_ZVENKU', gpsLat: 49.83, gpsLng: 18.29, autor: 'Olga Obchodní' })
    expect(f1.url).toMatch(/\/uploads\/.+\.jpg\?exp=\d+&sig=/)

    const r2 = await fotkyPost(fotoReq({ mobileId, tag: 'DUM_ZVENKU' }), p())
    expect(r2.status).toBe(200)
    expect((await r2.json()).id).toBe(f1.id)
    expect(await prisma.photo.count({ where: { orgId, mobileId } })).toBe(1)
  })

  it('odmítne soubor, který není obrázek', async () => {
    const r = await fotkyPost(fotoReq({}, Buffer.from('<html>nejsem fotka</html>')), p())
    expect(r.status).toBe(415)
  })

  it('galerie sjednocuje fotky k OP a ze zaměření, detail vrací titulní fotku a štítky', async () => {
    const z = await prisma.zamereni.create({ data: { orgId, dealId, typ: 'TEPELNE_CERPADLO', autorId: userId } })
    await prisma.zamereniFoto.create({ data: { orgId, zamereniId: z.id, url: '/uploads/zamereni/x/1.jpg', tag: 'ROZVADEC' } })

    const fotky = await (await fotkyGet(jsonReq('GET'), p())).json()
    expect(fotky.map((f: { zdroj: string }) => f.zdroj).sort()).toEqual(['PRIPAD', 'ZAMERENI'])

    const detail = await (await pripadGet(jsonReq('GET'), p())).json()
    expect(detail.titulniFoto.tag).toBe('DUM_ZVENKU')
    expect(detail.fotky).toHaveLength(2)
    expect(detail.fotoStitky).toEqual(VYCHOZI_FOTO_STITKY)
  })

  it('úprava štítku a smazání fotky', async () => {
    const f = await prisma.photo.findFirstOrThrow({ where: { orgId, dealId } })
    const r = await fotkaPatch(jsonReq('PATCH', { tag: 'MISTO_VJ', popis: '  roh domu ' }), { params: { id: dealId, fotoId: f.id } })
    expect(await r.json()).toMatchObject({ tag: 'MISTO_VJ', popis: 'roh domu' })
    const d = await fotkaDelete(jsonReq('DELETE'), { params: { id: dealId, fotoId: f.id } })
    expect(d.status).toBe(200)
    expect(await prisma.photo.count({ where: { id: f.id } })).toBe(0)
  })

  it('jiná firma fotky OP nevidí ani nenahraje', async () => {
    const cizi = await prisma.organization.create({ data: { nazev: 'Cizí', slug: `${RUN}-cizi`, plan: 'PROFESSIONAL' } })
    cizíOrgId = cizi.id
    const u = await prisma.user.create({ data: { orgId: cizi.id, jmeno: 'Cizák', email: `cizak-${RUN}@example.cz`, role: 'ADMIN', hesloHash: 'x' } })
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: u.id, orgId: cizi.id, role: 'ADMIN', plan: 'PROFESSIONAL' } } as never)
    expect((await fotkyGet(jsonReq('GET'), p())).status).toBe(404)
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: u.id, orgId: cizi.id, role: 'ADMIN', plan: 'PROFESSIONAL' } } as never)
    expect((await fotkyPost(fotoReq({}), p())).status).toBe(404)
  })

  it('fotoStitkyOrg: vlastní sada firmy, nesmysl → výchozí', () => {
    expect(fotoStitkyOrg([{ klic: 'STRECHA', nazev: 'Střecha' }])).toEqual([{ klic: 'STRECHA', nazev: 'Střecha' }])
    expect(fotoStitkyOrg([{ klic: 'špatně', nazev: 'x' }])).toEqual(VYCHOZI_FOTO_STITKY)
    expect(fotoStitkyOrg(null)).toEqual(VYCHOZI_FOTO_STITKY)
  })
})

describe('místo stavby', () => {
  const p = () => ({ params: { id: dealId } })

  it('PATCH uloží GPS, odmítne nesmysl a null obojí smaže', async () => {
    expect((await pripadPatch(jsonReq('PATCH', { gpsLat: 49.8, gpsLng: 18.2 }), p())).status).toBe(200)
    expect(await prisma.deal.findUnique({ where: { id: dealId }, select: { gpsLat: true, gpsLng: true } })).toEqual({ gpsLat: 49.8, gpsLng: 18.2 })
    expect((await pripadPatch(jsonReq('PATCH', { gpsLat: 200, gpsLng: 18 }), p())).status).toBe(400)
    expect((await pripadPatch(jsonReq('PATCH', { gpsLat: null, gpsLng: null }), p())).status).toBe(200)
    expect((await prisma.deal.findUnique({ where: { id: dealId } }))!.gpsLat).toBeNull()
  })
})
