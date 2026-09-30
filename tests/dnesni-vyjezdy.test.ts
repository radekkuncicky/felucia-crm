import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { orgPrisma } from '@/lib/orgPrisma'
import { ROLE_PRESETS } from '@/lib/permissions'
import { dnesniVyjezdy, dnesPraha } from '@/lib/dnesniVyjezdy'

const RUN = `dnes-${Date.now()}`
// 5. 10. 2026 10:00 pražského času
const NOW = new Date('2026-10-05T08:00:00Z')
const d = (s: string) => new Date(`${s}T00:00:00Z`)

let orgId: string, technikId: string, jinyId: string, klientId: string
const ids: Record<string, string> = {}
// technik se servisem (vlastní zásahy) — preset TECHNIK servis nemá
const TECHNIK_SERVIS = { ...ROLE_PRESETS.TECHNIK, servis: 'VLASTNI' as const }

beforeAll(async () => {
  orgId = (await prisma.organization.create({ data: { nazev: 'Test Dnes', slug: RUN, plan: 'PROFESSIONAL' } })).id
  technikId = (await prisma.user.create({ data: { orgId, jmeno: 'Tomáš', email: `${RUN}-t@x.cz`, hesloHash: 'x', role: 'TECHNIK' } })).id
  jinyId = (await prisma.user.create({ data: { orgId, jmeno: 'Petr', email: `${RUN}-p@x.cz`, hesloHash: 'x', role: 'TECHNIK' } })).id
  klientId = (await prisma.client.create({ data: { orgId, jmeno: 'Jan', prijmeni: 'Novák', telefon: '+420111', ulice: 'Sadová 1', mesto: 'Ostrava' } })).id

  const zak = async (key: string, data: Record<string, unknown>, technik: string | null = technikId) => {
    ids[key] = (await prisma.zakazka.create({
      data: { orgId, cislo: `${RUN}-${key}`, nazev: key, klientId, ...data, ...(technik ? { techniciRel: { create: [{ technikId: technik }] } } : {}) },
    })).id
  }
  await zak('vicedenni', { montazOd: d('2026-10-04'), montazDo: d('2026-10-06') })
  await zak('jednodenni', { montazOd: d('2026-10-05') })
  await zak('etapa', {})
  await prisma.zakazkaEtapa.create({ data: { orgId, zakazkaId: ids.etapa, cislo: 1, montazOd: d('2026-10-05'), montazDo: d('2026-10-05') } })
  await zak('cizi', { montazOd: d('2026-10-05') }, jinyId)
  await zak('vcera', { montazOd: d('2026-10-03'), montazDo: d('2026-10-04') })

  const serv = async (key: string, termin: string, technik: string) => {
    ids[key] = (await prisma.servisniZakazka.create({
      data: { orgId, cislo: `${RUN}-${key}`, klientId, technikId: technik, stav: 'NAPLANOVANA', planovanyTermin: new Date(termin), popis: key },
    })).id
  }
  await serv('servisRano', '2026-10-05T07:30:00Z', technikId)
  await serv('servisPulnoc', '2026-10-04T22:30:00Z', technikId) // 00:30 v Praze 5. 10.
  await serv('servisCizi', '2026-10-05T09:00:00Z', jinyId)
  await serv('servisZitra', '2026-10-05T22:30:00Z', technikId) // 00:30 v Praze 6. 10.
})

afterAll(async () => {
  await prisma.servisniZakazka.deleteMany({ where: { orgId } })
  await prisma.zakazkaEtapa.deleteMany({ where: { orgId } })
  await prisma.technikZakazka.deleteMany({ where: { zakazka: { orgId } } })
  await prisma.zakazka.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.orgSettings.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
})

describe('Dnešní výjezdy technika', () => {
  it('dnešek v Praze', () => {
    expect(dnesPraha(new Date('2026-10-04T22:30:00Z'))).toBe('2026-10-05')
  })

  it('montáže v rozsahu (i vícedenní a etapy) + servis na pražský dnešek, jen vlastní', async () => {
    const v = await dnesniVyjezdy(orgPrisma(orgId), {
      orgId, userId: technikId, perms: TECHNIK_SERVIS, plan: 'PROFESSIONAL', modulServis: true, now: NOW,
    })
    const nalezeno = v.map(x => x.id).sort()
    expect(nalezeno).toEqual([ids.vicedenni, ids.jednodenni, ids.etapa, ids.servisRano, ids.servisPulnoc].sort())
    const rano = v.find(x => x.id === ids.servisRano)!
    expect(rano.cas).toBe('09:30')
    expect(rano.adresa).toBe('Sadová 1, Ostrava')
    expect(v.find(x => x.id === ids.jednodenni)!.telefon).toBe('+420111')
  })

  it('bez servisního modulu jen montáže', async () => {
    const v = await dnesniVyjezdy(orgPrisma(orgId), {
      orgId, userId: technikId, perms: TECHNIK_SERVIS, plan: 'PROFESSIONAL', modulServis: false, now: NOW,
    })
    expect(v.every(x => x.typ === 'montaz')).toBe(true)
  })
})
