import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { ROLE_PRESETS } from '@/lib/permissions'
import { nastrojeProKontext } from '@/lib/ai/tools'
import { executeProvozTool } from '@/lib/ai/tools/provoz'
import { executeZakazkaTool } from '@/lib/ai/tools/zakazky'
import type { AiKontext } from '@/lib/ai/types'

/**
 * MCP provoz: list_orders s filtry, operations_stats, weekly_report —
 * zakázky jen vlastní firmy, montáže zakázek i etap, vytížení techniků.
 */

const RUN = `provoz-${Date.now()}`
const NOW = new Date('2026-10-20T10:00:00Z') // úterý

let orgA: { id: string }
let orgB: { id: string }
let jednatel: AiKontext
let technik: AiKontext
let technikId: string

const d = (s: string) => new Date(`${s}T10:00:00Z`)
const den = (s: string) => new Date(`${s}T00:00:00Z`)

beforeAll(async () => {
  orgA = await prisma.organization.create({ data: { nazev: 'Provoz A', slug: RUN } })
  orgB = await prisma.organization.create({ data: { nazev: 'Provoz B', slug: `${RUN}-b` } })
  const uJ = await prisma.user.create({ data: { orgId: orgA.id, jmeno: 'Jednatel', email: `${RUN}-j@test.cz`, hesloHash: 'x', role: 'JEDNATEL' } })
  const uT = await prisma.user.create({ data: { orgId: orgA.id, jmeno: 'Veči', email: `${RUN}-t@test.cz`, hesloHash: 'x', role: 'TECHNIK' } })
  technikId = uT.id
  jednatel = { orgId: orgA.id, userId: uJ.id, role: 'JEDNATEL', jmeno: 'Jednatel', perms: ROLE_PRESETS.JEDNATEL, zdroj: 'mcp' }
  technik = { orgId: orgA.id, userId: uT.id, role: 'TECHNIK', jmeno: 'Veči', perms: ROLE_PRESETS.TECHNIK, zdroj: 'mcp' }

  const kA = await prisma.client.create({ data: { orgId: orgA.id, jmeno: 'Jana', prijmeni: 'Nová' } })
  const kB = await prisma.client.create({ data: { orgId: orgB.id, jmeno: 'Cizí', prijmeni: 'Klient' } })

  // OP vyhraný 10. 9. za 100k → zakázka 1 namontovaná 13.–14. 10., hotová 15. 10., vyúčtováno 120k
  const op = await prisma.deal.create({
    data: { orgId: orgA.id, clientId: kA.id, kod: `${RUN}-OP`, technologie: 'KLIMA', stav: 'USPECH', userId: uJ.id, vytvoreno: d('2026-08-20'), vyhrano: d('2026-09-10') },
  })
  await prisma.quote.create({
    data: {
      orgId: orgA.id, dealId: op.id, aktivni: true, dphSazba: 12, vytvoreno: d('2026-08-25'),
      items: { create: [{ dealId: op.id, nazev: 'Klima', mnozstvi: 1, cenaZaKus: 100000, sleva: 0 }] },
    },
  })
  const z1 = await prisma.zakazka.create({
    data: {
      orgId: orgA.id, cislo: `${RUN}-1`, klientId: kA.id, opId: op.id, nazev: 'Klima Nová', technologie: 'KLIMA',
      stav: 'HOTOVO', montazOd: den('2026-10-13'), montazDo: den('2026-10-14'), uzavreno: d('2026-10-15'),
    },
  })
  await prisma.vyuctovani.create({
    data: { orgId: orgA.id, zakazkaId: z1.id, cislo: `${RUN}-V1`, stav: 'SCHVALENO', polozky: { create: [{ nazev: 'Montáž', mnozstvi: 1, prodejniCena: 120000 }] } },
  })
  // zakázka 2: montáž 16. 10. proběhla, ale pořád v realizaci → po termínu; úkol po termínu
  const z2 = await prisma.zakazka.create({
    data: { orgId: orgA.id, cislo: `${RUN}-2`, klientId: kA.id, nazev: 'Rekuperace', technologie: 'REKUPERACE', stav: 'V_REALIZACI', montazOd: den('2026-10-16'), montazDo: den('2026-10-16') },
  })
  await prisma.zakazkaUkol.create({ data: { orgId: orgA.id, zakazkaId: z2.id, text: 'Doladit regulaci', termin: den('2026-10-18') } })
  // zakázka 3: dvě etapy — 26.–27. 10. (příští týden) a 5. 11.
  const z3 = await prisma.zakazka.create({
    data: { orgId: orgA.id, cislo: `${RUN}-3`, klientId: kA.id, nazev: 'TČ', technologie: 'TEPELNE_CERPADLO', stav: 'PRIRAZENA' },
  })
  await prisma.zakazkaEtapa.createMany({
    data: [
      { orgId: orgA.id, zakazkaId: z3.id, cislo: 1, montazOd: den('2026-10-26'), montazDo: den('2026-10-27') },
      { orgId: orgA.id, zakazkaId: z3.id, cislo: 2, montazOd: den('2026-11-05'), montazDo: den('2026-11-05') },
    ],
  })
  await prisma.technikZakazka.createMany({ data: [z1, z2, z3].map(z => ({ zakazkaId: z.id, technikId: uT.id })) })
  // zakázka bez technika — technik ji nevidí
  await prisma.zakazka.create({
    data: { orgId: orgA.id, cislo: `${RUN}-4`, klientId: kA.id, nazev: 'Bez technika', stav: 'NOVA', montazOd: den('2026-10-05') },
  })

  await prisma.zakazka.create({
    data: { orgId: orgB.id, cislo: `${RUN}-B`, klientId: kB.id, nazev: 'Cizí', stav: 'HOTOVO', montazOd: den('2026-10-13'), uzavreno: d('2026-10-15') },
  })
})

afterAll(async () => {
  const orgIds = [orgA.id, orgB.id]
  await prisma.vyuctovani.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.zakazka.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.auditLog.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.quoteItem.deleteMany({ where: { deal: { orgId: { in: orgIds } } } })
  await prisma.quote.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.deal.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.client.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.user.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
  await prisma.$disconnect()
})

const run = async (ctx: AiKontext, name: string, input: Record<string, unknown> = {}) =>
  JSON.parse((await (name === 'list_orders' ? executeZakazkaTool(ctx, name, input) : executeProvozTool(ctx, name, input, NOW))).result)

describe('dostupnost', () => {
  it('provozní nástroje jen v MCP, podle přístupu k zakázkám', () => {
    const jmena = (c: AiKontext) => nastrojeProKontext(c).map(t => t.name)
    expect(jmena(jednatel)).toEqual(expect.arrayContaining(['operations_stats', 'weekly_report', 'help_analytics']))
    expect(jmena({ ...jednatel, zdroj: 'web' })).not.toContain('weekly_report')
    expect(jmena(technik)).toContain('operations_stats')
    expect(jmena({ ...technik, perms: { ...technik.perms, zakazky: 'ZADNE', obchod: false } })).not.toContain('weekly_report')
  })
})

describe('list_orders', () => {
  it('filtr podle montáže zachytí i etapu', async () => {
    const r = await run(jednatel, 'list_orders', { od: '2026-10-26', do: '2026-11-01' })
    expect(r.polozky.map((z: { cislo: string }) => z.cislo)).toEqual([`${RUN}-3`])
    expect(r.polozky[0].montaz).toBe('2026-10-26 – 2026-11-05')
  })

  it('hodnota, vyúčtování, OP a úkoly; technik bez cen', async () => {
    const r = await run(jednatel, 'list_orders', { od: '2026-10-01', do: '2026-10-31', technikId })
    expect(r.polozky.map((z: { cislo: string }) => z.cislo)).toEqual([`${RUN}-1`, `${RUN}-2`, `${RUN}-3`])
    expect(r.polozky[0]).toMatchObject({ op: `${RUN}-OP`, hodnotaBezDph: 100000, vyuctovanoBezDph: 120000, dokonceno: '2026-10-15' })
    expect(r.polozky[1]).toMatchObject({ otevreneUkoly: 1, ukolyPoTerminu: 1 })
    const t = await run(technik, 'list_orders', { od: '2026-10-01', do: '2026-10-31' })
    expect(t.polozky).toHaveLength(3)
    expect(t.polozky[0].hodnotaBezDph).toBeUndefined()
  })

  it('filtr stavu a technologie', async () => {
    const r = await run(jednatel, 'list_orders', { stav: ['V_REALIZACI'], technologie: 'REKUPERACE' })
    expect(r.polozky.map((z: { cislo: string }) => z.cislo)).toEqual([`${RUN}-2`])
  })
})

describe('operations_stats', () => {
  it('říjen: dokončené, objem, doba od výhry, vytížení, po termínu', async () => {
    const r = await run(jednatel, 'operations_stats', { od: '2026-10-01', do: '2026-10-31' })
    expect(r.celkem).toMatchObject({ dokonceneZakazky: 1, objemDokoncenychBezDph: 120000, zahajeneMontaze: 1, prumerDniOdVyhryOpPoMontaz: 33 })
    expect(r.vytizeniTechniku.pracovnichDnuVObdobi).toBe(22)
    // 13., 14., 16., 26., 27. 10. (etapa 5. 11. je mimo období)
    expect(r.vytizeniTechniku.technici).toEqual([expect.objectContaining({ jmeno: 'Veči', montaznichDni: 5, zakazek: 3, vytizeniProc: 23 })])
    expect(r.vytizeniTechniku.montaziBezTechnika).toBe(1)
    // zakázka 2 (16. 10.) + zakázka bez technika (5. 10.)
    expect(r.zakazkyPoTerminu.polozky.map((z: { cislo: string; dniPoTerminu: number }) => [z.cislo, z.dniPoTerminu]))
      .toEqual([[`${RUN}-4`, 15], [`${RUN}-2`, 4]])
  })

  it('technik vidí jen svoje zakázky a bez objemu', async () => {
    const r = await run(technik, 'operations_stats', { od: '2026-10-01', do: '2026-10-31', porovnat_s_predchozim: true })
    expect(r.celkem.objemDokoncenychBezDph).toBeUndefined()
    expect(r.zakazkyPoTerminu.pocet).toBe(1)
    expect(r.predchozi.obdobi).toEqual({ od: '2026-08-31', do: '2026-09-30' })
  })
})

describe('weekly_report', () => {
  it('tento a minulý týden, montáže příští týden, úkoly po termínu', async () => {
    const r = await run(jednatel, 'weekly_report')
    expect(r.tyden).toEqual({ od: '2026-10-14', do: '2026-10-20' })
    expect(r.obchod.noveOp).toBeDefined()
    expect(r.realizace.dokonceneZakazky).toMatchObject({ tento: 1, minuly: 0 })
    expect(r.realizace.dokonceneZakazky.polozky[0]).toMatchObject({ cislo: `${RUN}-1`, vyuctovanoBezDph: 120000 })
    expect(r.realizace.montazePristiTyden).toMatchObject({ od: '2026-10-26', do: '2026-11-01', pocet: 1 })
    expect(r.realizace.montazePristiTyden.polozky[0]).toMatchObject({ cislo: `${RUN}-3`, technici: ['Veči'] })
    expect(r.realizace.ukolyZakazekPoTerminu).toMatchObject({ pocet: 1 })
  })

  it('technik bez obchodu dostane jen realizaci', async () => {
    const r = await run(technik, 'weekly_report')
    expect(r.obchod).toBeUndefined()
    expect(r.realizace.zakazkyPoTerminu.pocet).toBe(1)
  })
})

describe('help_analytics', () => {
  it('vrací nástroje a postupy', async () => {
    const r = await run(jednatel, 'help_analytics')
    expect(r.nastroje.map((n: { nastroj: string }) => n.nastroj)).toContain('operations_stats')
    expect(r.postupy.length).toBeGreaterThan(0)
  })
})
