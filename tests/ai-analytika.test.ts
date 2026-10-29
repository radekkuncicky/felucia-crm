import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { ROLE_PRESETS } from '@/lib/permissions'
import { nastrojeProKontext } from '@/lib/ai/tools'
import { executeAnalytikaTool } from '@/lib/ai/tools/analytika'
import { executePipelineTool } from '@/lib/ai/tools/pipeline'
import type { AiKontext } from '@/lib/ai/types'

/**
 * MCP analytika obchodu: list_deals / sales_stats — data jen vlastní firmy,
 * obchodník jen svoje OP, datum prohry z historie změn, srovnání období.
 */

const RUN = `analytika-${Date.now()}`
const NOW = new Date('2026-10-20T10:00:00Z')

let orgA: { id: string }
let orgB: { id: string }
let jednatel: AiKontext
let obchodnik: AiKontext

const d = (s: string) => new Date(`${s}T10:00:00Z`)

async function op(orgId: string, clientId: string, p: {
  kod: string; userId?: string; stav?: 'NOVY' | 'NABIDKA' | 'USPECH' | 'PAS'; vytvoreno: string; vyhrano?: string
  prohra?: string; cena?: number; nabidka?: string
}) {
  const deal = await prisma.deal.create({
    data: {
      orgId, clientId, kod: `${RUN}-${p.kod}`, technologie: 'KLIMA', stav: p.stav ?? 'NOVY', userId: p.userId,
      vytvoreno: d(p.vytvoreno), vyhrano: p.vyhrano ? d(p.vyhrano) : null,
      duvodProhryKod: p.prohra ? 'CENA' : null,
    },
  })
  if (p.cena) {
    await prisma.quote.create({
      data: {
        orgId, dealId: deal.id, aktivni: true, dphSazba: 12, vytvoreno: d(p.nabidka ?? p.vytvoreno),
        items: { create: [{ dealId: deal.id, nazev: 'Klima', mnozstvi: 1, cenaZaKus: p.cena, sleva: 0 }] },
      },
    })
  }
  if (p.prohra) {
    // historii píše trigger s aktuálním časem — prohru k danému dni vložíme ručně
    await prisma.dealStavZmena.create({ data: { orgId, dealId: deal.id, zStavu: 'NABIDKA', naStav: 'PAS', vytvoreno: d(p.prohra) } })
  }
  return deal
}

beforeAll(async () => {
  orgA = await prisma.organization.create({ data: { nazev: 'Analytika A', slug: RUN } })
  orgB = await prisma.organization.create({ data: { nazev: 'Analytika B', slug: `${RUN}-b` } })
  const uJ = await prisma.user.create({ data: { orgId: orgA.id, jmeno: 'Jednatel', email: `${RUN}-j@test.cz`, hesloHash: 'x', role: 'JEDNATEL' } })
  const uO = await prisma.user.create({ data: { orgId: orgA.id, jmeno: 'Obchodník', email: `${RUN}-o@test.cz`, hesloHash: 'x', role: 'OBCHODNIK' } })
  jednatel = { orgId: orgA.id, userId: uJ.id, role: 'JEDNATEL', jmeno: 'Jednatel', perms: ROLE_PRESETS.JEDNATEL, zdroj: 'mcp' }
  obchodnik = { orgId: orgA.id, userId: uO.id, role: 'OBCHODNIK', jmeno: 'Obchodník', perms: { ...ROLE_PRESETS.OBCHODNIK, obchodCiziOP: false }, zdroj: 'mcp' }

  const kA = await prisma.client.create({ data: { orgId: orgA.id, jmeno: 'Jana', prijmeni: 'Nová', mesto: 'Opava' } })
  const kB = await prisma.client.create({ data: { orgId: orgB.id, jmeno: 'Cizí', prijmeni: 'Klient' } })

  // září: 1 výhra (100k), 1 prohra (50k); říjen: 1 výhra obchodníka (200k), 1 nový bez nabídky
  await op(orgA.id, kA.id, { kod: '1', userId: uJ.id, stav: 'USPECH', vytvoreno: '2026-08-20', vyhrano: '2026-09-10', cena: 100000 })
  await op(orgA.id, kA.id, { kod: '2', userId: uJ.id, stav: 'PAS', vytvoreno: '2026-09-02', prohra: '2026-09-25', cena: 50000 })
  await op(orgA.id, kA.id, { kod: '3', userId: uO.id, stav: 'USPECH', vytvoreno: '2026-10-01', vyhrano: '2026-10-11', cena: 200000 })
  await op(orgA.id, kA.id, { kod: '4', userId: uJ.id, vytvoreno: '2026-10-05' })
  await op(orgB.id, kB.id, { kod: 'B', stav: 'USPECH', vytvoreno: '2026-09-05', vyhrano: '2026-09-06', cena: 999999 })

  await prisma.lead.create({ data: { orgId: orgA.id, jmeno: 'Lead září', vytvoreno: d('2026-09-03'), assignedToId: uJ.id } })

  // pipeline: nabídka bez aktivity od září (urgentní) + úkol po termínu
  const n = await op(orgA.id, kA.id, { kod: '5', userId: uJ.id, stav: 'NABIDKA', vytvoreno: '2026-09-15', cena: 80000 })
  await prisma.activity.create({ data: { orgId: orgA.id, dealId: n.id, userId: uJ.id, typ: 'UKOL', popis: 'Zavolat Nové', datum: d('2026-10-10') } })
  await prisma.activity.create({ data: { orgId: orgA.id, dealId: n.id, userId: uJ.id, typ: 'HOVOR', popis: 'Hotovo', datum: d('2026-10-30'), stav: 'DOKONCENA' } })
})

afterAll(async () => {
  const orgIds = [orgA.id, orgB.id]
  await prisma.activity.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.lead.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.auditLog.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.quoteItem.deleteMany({ where: { deal: { orgId: { in: orgIds } } } })
  await prisma.quote.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.deal.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.client.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.user.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
  await prisma.$disconnect()
})

const run = async (ctx: AiKontext, name: string, input: Record<string, unknown>) =>
  JSON.parse((await (name === 'pipeline_snapshot' || name === 'deal_timeline'
    ? executePipelineTool(ctx, name, input, NOW)
    : executeAnalytikaTool(ctx, name, input, NOW))).result)

describe('dostupnost', () => {
  it('analytika jen v MCP a jen s obchodem', () => {
    const jmena = (c: AiKontext) => nastrojeProKontext(c).map(t => t.name)
    expect(jmena(jednatel)).toEqual(expect.arrayContaining(['list_deals', 'sales_stats', 'pipeline_snapshot', 'deal_timeline']))
    expect(jmena({ ...jednatel, zdroj: 'web' })).not.toContain('pipeline_snapshot')
    expect(jmena({ ...jednatel, zdroj: 'web' })).not.toContain('sales_stats')
    expect(jmena({ ...jednatel, perms: ROLE_PRESETS.TECHNIK })).not.toContain('list_deals')
  })

  it('technik dostane chybu i při přímém volání', async () => {
    expect((await run({ ...jednatel, perms: ROLE_PRESETS.TECHNIK }, 'sales_stats', {})).chyba).toBeTruthy()
  })
})

describe('list_deals', () => {
  it('vrací jen OP vlastní firmy s odvozenými daty', async () => {
    const r = await run(jednatel, 'list_deals', {})
    expect(r.celkem).toBe(5)
    expect(r.polozky.some((p: { kod: string }) => p.kod === `${RUN}-B`)).toBe(false)
    const prohra = r.polozky.find((p: { kod: string }) => p.kod === `${RUN}-2`)
    expect(prohra).toMatchObject({ stav: 'PAS', uzavreno: '2026-09-25', zmenaStavu: '2026-09-25', hodnotaBezDph: 50000, hodnotaSDph: 56000, mesto: 'Opava' })
    expect(prohra.duvodProhry.kod).toBe('CENA')
  })

  it('filtr podle uzavření + stránkování', async () => {
    const r = await run(jednatel, 'list_deals', { od: '2026-09-01', do: '2026-09-30', podle: 'uzavreni', limit: 1 })
    expect(r.celkem).toBe(2)
    expect(r.polozky).toHaveLength(1)
    expect(r.nextCursor).toBe('1')
    const r2 = await run(jednatel, 'list_deals', { od: '2026-09-01', do: '2026-09-30', podle: 'uzavreni', limit: 1, cursor: '1' })
    expect(r2.nextCursor).toBeNull()
    expect(r2.polozky[0].kod).not.toBe(r.polozky[0].kod)
  })

  it('obchodník bez cizích OP vidí jen svoje, i když pošle cizí obchodnikId', async () => {
    const r = await run(obchodnik, 'list_deals', { obchodnikId: jednatel.userId })
    expect(r.celkem).toBe(0)
    expect((await run(obchodnik, 'list_deals', {})).polozky.map((p: { kod: string }) => p.kod)).toEqual([`${RUN}-3`])
  })
})

describe('sales_stats', () => {
  it('září: výhra, prohra, win rate, lead, objem', async () => {
    const r = await run(jednatel, 'sales_stats', { od: '2026-09-01', do: '2026-09-30' })
    expect(r.celkem).toMatchObject({
      noveLeady: 1, noveOp: 2, vyhrane: 1, prohrane: 1, winRateProc: 50,
      objemVyhranychBezDph: 100000, prumernaVyhranaBezDph: 100000, duvodyProher: { CENA: 1 },
      nabidnuteOp: 2, objemNabidekBezDph: 130000,
    })
  })

  it('seskupení po měsících a srovnání s předchozím obdobím', async () => {
    const r = await run(jednatel, 'sales_stats', { od: '2026-10-01', do: '2026-10-31', seskupit: 'mesic', porovnat_s_predchozim: true })
    expect(r.celkem.objemVyhranychBezDph).toBe(200000)
    expect(r.skupiny.map((s: { klic: string }) => s.klic)).toEqual(['2026-10'])
    expect(r.predchozi.obdobi).toEqual({ od: '2026-08-31', do: '2026-09-30' })
    expect(r.rozdilProc.objemVyhranychBezDph).toBe(100)
  })

  it('seskupení podle obchodníka', async () => {
    const r = await run(jednatel, 'sales_stats', { od: '2026-09-01', do: '2026-10-31', seskupit: 'obchodnik' })
    const o = r.skupiny.find((s: { nazev: string }) => s.nazev === 'Obchodník')
    expect(o).toMatchObject({ vyhrane: 1, objemVyhranychBezDph: 200000 })
  })
})

describe('pipeline_snapshot', () => {
  it('otevřené stavy, stáří ve stavu a urgence', async () => {
    const r = await run(jednatel, 'pipeline_snapshot', {})
    expect(r.kDatu).toBe('2026-10-20')
    const novy = r.stavy.find((s: { stav: string }) => s.stav === 'NOVY')
    expect(novy).toMatchObject({ pocet: 1, bezNabidky: 1, maxDniVeStavu: 15 })
    const nab = r.stavy.find((s: { stav: string }) => s.stav === 'NABIDKA')
    expect(nab).toMatchObject({ pocet: 1, hodnotaBezDph: 80000 })
    // úkol po termínu ani budoucí dokončený hovor (30. 10.) kontakt nejsou → bez aktivity od založení
    expect(r.k_urgenci.nabidkyBezAktivity.polozky[0]).toMatchObject({ kod: `${RUN}-5`, dniBezAktivity: 35 })
    expect(r.k_urgenci.ukolyPoTerminu.pocet).toBe(1)
    expect(r.k_urgenci.ukolyPoTerminu.polozky[0]).toMatchObject({ popis: 'Zavolat Nové', dniPoTerminu: 10, op: `${RUN}-5` })
  })

  it('k datu v minulosti: OP založené později chybí', async () => {
    const r = await run(jednatel, 'pipeline_snapshot', { k_datu: '2026-09-30' })
    expect(r.otevreno.pocet).toBe(1)
    expect(r.stavy.find((s: { stav: string }) => s.stav === 'NABIDKA').pocet).toBe(1)
  })

  it('obchodník bez cizích OP: prázdná pipeline i úkoly', async () => {
    const r = await run(obchodnik, 'pipeline_snapshot', {})
    expect(r.otevreno.pocet).toBe(0)
    expect(r.k_urgenci.ukolyPoTerminu.pocet).toBe(0)
  })
})

describe('deal_timeline', () => {
  it('založení, nabídka a prohra chronologicky', async () => {
    const r = await run(jednatel, 'deal_timeline', { dealId: `${RUN}-2` })
    expect(r.udalosti.map((u: { typ: string }) => u.typ)).toEqual(['zalozeni', 'nabidka', 'zmena_stavu'])
    expect(r.udalosti[2]).toMatchObject({ datum: '2026-09-25', z: 'NABIDKA', na: 'PAS' })
  })

  it('cizí firma ani obchodník bez přístupu OP nedostanou', async () => {
    expect((await run(obchodnik, 'deal_timeline', { dealId: `${RUN}-2` })).chyba).toBeTruthy()
    expect((await run(jednatel, 'deal_timeline', { dealId: `${RUN}-B` })).chyba).toBeTruthy()
  })
})
