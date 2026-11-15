import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { ROLE_PRESETS } from '@/lib/permissions'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { getServerSession } from 'next-auth'
import { GET as detailGet } from '@/app/api/mobile/zakazka/[id]/route'
import { GET as seznamGet } from '@/app/api/mobile/zakazky/route'
import { GET as dnesGet } from '@/app/api/mobile/dnes/route'
import { dnesPraha } from '@/lib/dnesniVyjezdy'

/** Felucia Tech: poloha stavby z obchodního případu (Sales „Jsem na místě“) v mobilním API zakázek */

const RUN = `techgps-${Date.now()}`
let orgId: string
let sGps: string
let bezGps: string

beforeAll(async () => {
  orgId = (await prisma.organization.create({ data: { nazev: 'Test Tech GPS', slug: RUN, plan: 'PROFESSIONAL' } })).id
  const technikId = (await prisma.user.create({ data: { orgId, jmeno: 'Technik', email: `${RUN}@example.cz`, hesloHash: 'x', role: 'TECHNIK' } })).id
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: technikId, orgId, role: 'TECHNIK', plan: 'PROFESSIONAL', perms: ROLE_PRESETS.TECHNIK } } as never)
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Jan', prijmeni: 'Parcela', mesto: 'Hlučín' } })
  const op = await prisma.deal.create({ data: { orgId, clientId: klient.id, technologie: 'TEPELNE_CERPADLO', gpsLat: 49.8971, gpsLng: 18.1903 } })
  const dnes = new Date(`${dnesPraha()}T00:00:00.000Z`)
  sGps = (await prisma.zakazka.create({
    data: { orgId, cislo: `${RUN}-1`, nazev: 'TČ parcela', klientId: klient.id, opId: op.id, stav: 'PRIRAZENA', montazOd: dnes, techniciRel: { create: { technikId } } },
  })).id
  bezGps = (await prisma.zakazka.create({
    data: { orgId, cislo: `${RUN}-2`, nazev: 'Bez OP', klientId: klient.id, stav: 'PRIRAZENA', montazOd: dnes, techniciRel: { create: { technikId } } },
  })).id
})

afterAll(async () => {
  await prisma.zakazka.deleteMany({ where: { orgId } })
  await prisma.deal.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {})
})

describe('GPS stavby pro techniky', () => {
  it('detail, seznam i Dnes vrací polohu z OP; bez OP null', async () => {
    const d = await (await detailGet(new Request('http://test'), { params: { id: sGps } })).json()
    expect(d.gps).toEqual({ lat: 49.8971, lng: 18.1903 })
    expect((await (await detailGet(new Request('http://test'), { params: { id: bezGps } })).json()).gps).toBeNull()

    const seznam = await (await seznamGet(new Request('http://test/api/mobile/zakazky'))).json()
    const polozky = (seznam.data ?? seznam) as { id: string; gps: unknown }[]
    expect(polozky.find(z => z.id === sGps)?.gps).toEqual({ lat: 49.8971, lng: 18.1903 })

    const dnes = await (await dnesGet(new Request('http://test'))).json()
    expect(dnes.zakazky.find((z: { id: string }) => z.id === sGps)?.gps).toEqual({ lat: 49.8971, lng: 18.1903 })
    expect(dnes.zakazky.find((z: { id: string }) => z.id === bezGps)?.gps).toBeNull()
  })
})
