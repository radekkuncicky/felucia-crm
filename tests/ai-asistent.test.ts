import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { ROLE_PRESETS } from '@/lib/permissions'
import { cistyVstup, executeAiTool, nastrojeProKontext } from '@/lib/ai/tools'
import { runAgent, pokracujPoPotvrzeni, type AnthropicLike } from '@/lib/ai/agent'
import type { AiKontext } from '@/lib/ai/types'

/**
 * AI asistentka: tenant z kontextu (nikdy od modelu), nástroje nad zakázkami,
 * audit volání a zápisy až po potvrzení uživatelem.
 */

const RUN = `ai-${Date.now()}`

let orgA: { id: string }
let orgB: { id: string }
let admin: AiKontext
let technik: AiKontext
let klientA: string
let zakazkaA: string
let zakazkaPotvrzeni: string
let zakazkaB: string

beforeAll(async () => {
  orgA = await prisma.organization.create({ data: { nazev: 'AI Test A', slug: RUN } })
  orgB = await prisma.organization.create({ data: { nazev: 'AI Test B', slug: `${RUN}-b` } })

  const uA = await prisma.user.create({ data: { orgId: orgA.id, jmeno: 'Radek A', email: `${RUN}-a@test.cz`, hesloHash: 'x', role: 'ADMIN' } })
  const uT = await prisma.user.create({ data: { orgId: orgA.id, jmeno: 'Veči T', email: `${RUN}-t@test.cz`, hesloHash: 'x', role: 'TECHNIK' } })
  const uB = await prisma.user.create({ data: { orgId: orgB.id, jmeno: 'Cizí B', email: `${RUN}-b@test.cz`, hesloHash: 'x', role: 'ADMIN' } })
  void uB

  admin = { orgId: orgA.id, userId: uA.id, role: 'ADMIN', jmeno: uA.jmeno, perms: ROLE_PRESETS.ADMIN, zdroj: 'web' }
  technik = { orgId: orgA.id, userId: uT.id, role: 'TECHNIK', jmeno: uT.jmeno, perms: ROLE_PRESETS.TECHNIK, zdroj: 'web' }

  const kA = await prisma.client.create({ data: { orgId: orgA.id, jmeno: 'Jana', prijmeni: 'Dvořáková', poznamka: 'Pes na zahradě' } })
  const kB = await prisma.client.create({ data: { orgId: orgB.id, jmeno: 'Petr', prijmeni: 'Cizí' } })
  klientA = kA.id

  zakazkaA = (await prisma.zakazka.create({ data: { orgId: orgA.id, cislo: `${RUN}-1`, klientId: kA.id, nazev: 'TČ Dvořáková' } })).id
  zakazkaPotvrzeni = (await prisma.zakazka.create({ data: { orgId: orgA.id, cislo: `${RUN}-2`, klientId: kA.id, nazev: 'Klima Dvořáková' } })).id
  zakazkaB = (await prisma.zakazka.create({ data: { orgId: orgB.id, cislo: `${RUN}-B`, klientId: kB.id, nazev: 'Cizí zakázka' } })).id
})

afterAll(async () => {
  const orgIds = [orgA.id, orgB.id]
  await prisma.aiCekajiciAkce.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.aiAuditLog.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.auditLog.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.zakazkaKomentar.deleteMany({ where: { zakazka: { orgId: { in: orgIds } } } })
  await prisma.zakazka.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.client.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.user.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
  await prisma.$disconnect()
})

describe('tenant jen z kontextu', () => {
  it('cistyVstup zahodí orgId / tenant_id od modelu', () => {
    expect(cistyVstup({ orgId: 'x', tenant_id: 'y', tenantId: 'z', org_id: 'w', q: 'a' })).toEqual({ q: 'a' })
    expect(cistyVstup(null)).toEqual({})
    expect(cistyVstup(['a'])).toEqual({})
  })

  it('cizí zakázku nenajde ani podle ID, ani s podstrčeným orgId', async () => {
    const r = await executeAiTool(admin, 'get_order', { zakazkaId: zakazkaB, orgId: orgB.id })
    expect(JSON.parse(r.result).chyba).toBeTruthy()
  })

  it('list_orders vrací jen zakázky vlastní org', async () => {
    const r = JSON.parse((await executeAiTool(admin, 'list_orders', { q: RUN })).result)
    const ids = r.map((z: { id: string }) => z.id)
    expect(ids).toContain(zakazkaA)
    expect(ids).not.toContain(zakazkaB)
  })
})

describe('nástroje nad zakázkami', () => {
  it('get_order podle čísla vrací detail a odkaz', async () => {
    const r = JSON.parse((await executeAiTool(admin, 'get_order', { zakazkaId: `${RUN}-1` })).result)
    expect(r.id).toBe(zakazkaA)
    expect(r.klient.jmeno).toBe('Jana Dvořáková')
    expect(r.odkaz).toBe(`/zakazky/${zakazkaA}`)
  })

  it('technik bez přiřazení zakázku nevidí a stav měnit nesmí', async () => {
    expect(JSON.parse((await executeAiTool(technik, 'get_order', { zakazkaId: zakazkaA })).result).chyba).toBeTruthy()
    const r = await executeAiTool(technik, 'update_order_status', { zakazkaId: zakazkaA, stav: 'PRIRAZENA' })
    expect(JSON.parse(r.result).chyba).toMatch(/oprávnění/)
  })

  it('technik nedostane zápisy obchodu ani změnu stavu zakázky', () => {
    const names = nastrojeProKontext(technik).map(t => t.name)
    expect(names).not.toContain('create_deal')
    expect(names).not.toContain('update_order_status')
    expect(names).toContain('add_note')
    expect(nastrojeProKontext(admin).map(t => t.name)).toContain('update_order_status')
  })

  it('update_order_status hlídá přechody a zapíše historii jako AI', async () => {
    const spatne = await executeAiTool(admin, 'update_order_status', { zakazkaId: zakazkaA, stav: 'HOTOVO' })
    expect(JSON.parse(spatne.result).chyba).toMatch(/není povolen/)

    const r = await executeAiTool(admin, 'update_order_status', { zakazkaId: zakazkaA, stav: 'PRIRAZENA' }, 'POTVRZENO')
    expect(JSON.parse(r.result).ok).toBe(true)
    expect((await prisma.zakazka.findUnique({ where: { id: zakazkaA } }))?.stav).toBe('PRIRAZENA')

    const hist = await prisma.auditLog.findFirst({ where: { orgId: orgA.id, zaznamId: zakazkaA }, orderBy: { vytvoreno: 'desc' } })
    expect(hist?.actorType).toBe('ai')
    expect(hist?.aiSource).toBe('web')
    expect(hist?.userId).toBe(admin.userId)

    const audit = await prisma.aiAuditLog.findFirst({ where: { orgId: orgA.id, nastroj: 'update_order_status', stav: 'POTVRZENO' } })
    expect(audit?.userId).toBe(admin.userId)
    expect(audit?.vstup).toEqual({ zakazkaId: zakazkaA, stav: 'PRIRAZENA' })
  })

  it('add_note: komentář k zakázce a připsání poznámky klientovi', async () => {
    await executeAiTool(admin, 'add_note', { zakazkaId: zakazkaA, text: 'Klíč u sousedky' })
    const k = await prisma.zakazkaKomentar.findFirst({ where: { zakazkaId: zakazkaA } })
    expect(k?.text).toBe('Klíč u sousedky')
    expect(k?.userId).toBe(admin.userId)

    await executeAiTool(admin, 'add_note', { klientId: klientA, text: 'Volat po 16h' })
    const klient = await prisma.client.findUnique({ where: { id: klientA } })
    expect(klient?.poznamka).toMatch(/^Pes na zahradě\n\[.*Radek A\] Volat po 16h$/)
  })
})

// ─── Smyčka s potvrzením (Claude API nahrazené skriptem odpovědí) ────────────

function fakeAnthropic(odpovedi: Partial<Anthropic.Message>[]) {
  const volani: Anthropic.MessageCreateParams[] = []
  const client = {
    messages: {
      create: async (params: Anthropic.MessageCreateParams) => {
        volani.push(JSON.parse(JSON.stringify(params)))
        const o = odpovedi.shift()
        if (!o) throw new Error('fakeAnthropic: došly odpovědi')
        return { usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0 }, ...o }
      },
    },
  } as unknown as AnthropicLike
  return { client, volani }
}

const toolUse = (id: string, name: string, input: Record<string, unknown>) =>
  ({ type: 'tool_use', id, name, input }) as Anthropic.ToolUseBlock
const text = (t: string) => ({ type: 'text', text: t, citations: null }) as Anthropic.TextBlock

describe('zápisy až po potvrzení', () => {
  it('zápis se neprovede, dokud ho uživatel nepotvrdí; čtení ze stejného kola ano', async () => {
    const { client, volani } = fakeAnthropic([
      {
        stop_reason: 'tool_use',
        content: [
          text('Posunu zakázku.'),
          toolUse('tu_read', 'get_order', { zakazkaId: zakazkaPotvrzeni }),
          toolUse('tu_write', 'update_order_status', { zakazkaId: zakazkaPotvrzeni, stav: 'PRIRAZENA', orgId: orgB.id }),
        ],
      },
      { stop_reason: 'end_turn', content: [text('{"message":"Hotovo, zakázka je přiřazená.","quickReplies":[]}')] },
    ])

    const v = await runAgent({ ctx: admin, model: 'test-model', system: 'SYS', messages: [{ role: 'user', content: 'přiřaď' }], anthropic: client })
    expect(v.typ).toBe('potvrzeni')
    if (v.typ !== 'potvrzeni') return
    expect(v.akce).toHaveLength(1)
    expect(v.akce[0].titulek).toBe('Změnit stav zakázky')
    expect(v.akce[0].radky.join(' ')).toMatch(/Nová → Přiřazená/)
    expect((await prisma.zakazka.findUnique({ where: { id: zakazkaPotvrzeni } }))?.stav).toBe('NOVA')

    const navrh = await prisma.aiAuditLog.findFirst({ where: { orgId: orgA.id, stav: 'NAVRZENO', nastroj: 'update_order_status' } })
    expect(navrh?.vstup).not.toHaveProperty('orgId')

    // cizí uživatel návrh potvrdit nemůže
    const cizi = await pokracujPoPotvrzeni({ ctx: technik, cekajiciId: v.cekajiciId, potvrdit: true, anthropic: client })
    expect(cizi.ok).toBe(false)

    const p = await pokracujPoPotvrzeni({ ctx: admin, cekajiciId: v.cekajiciId, potvrdit: true, anthropic: client })
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.provedeno).toEqual([{ titulek: 'Změnit stav zakázky', ok: true }])
    expect(p.dalsi.typ).toBe('odpoved')
    expect((await prisma.zakazka.findUnique({ where: { id: zakazkaPotvrzeni } }))?.stav).toBe('PRIRAZENA')

    // pokračování dostalo výsledky obou nástrojů z přerušeného kola
    const posledni = volani[1].messages[volani[1].messages.length - 1]
    const ids = (posledni.content as Anthropic.ToolResultBlockParam[]).map(b => b.tool_use_id)
    expect(ids.sort()).toEqual(['tu_read', 'tu_write'])
    expect(volani[1].system).toEqual(volani[0].system)

    // druhé potvrzení téhož návrhu nic neudělá
    const znovu = await pokracujPoPotvrzeni({ ctx: admin, cekajiciId: v.cekajiciId, potvrdit: true, anthropic: client })
    expect(znovu.ok).toBe(false)
  })

  it('zrušení: nic se nezapíše a model dostane „zruseno"', async () => {
    const { client, volani } = fakeAnthropic([
      { stop_reason: 'tool_use', content: [toolUse('tu_n', 'add_note', { zakazkaId: zakazkaPotvrzeni, text: 'Nechci' })] },
      { stop_reason: 'end_turn', content: [text('{"message":"Dobře, nechávám být.","quickReplies":[]}')] },
    ])
    const v = await runAgent({ ctx: admin, model: 'test-model', system: 'SYS', messages: [{ role: 'user', content: 'pozn' }], anthropic: client })
    if (v.typ !== 'potvrzeni') throw new Error('čekal jsem návrh')

    const p = await pokracujPoPotvrzeni({ ctx: admin, cekajiciId: v.cekajiciId, potvrdit: false, anthropic: client })
    expect(p.ok).toBe(true)
    expect(await prisma.zakazkaKomentar.count({ where: { zakazkaId: zakazkaPotvrzeni } })).toBe(0)
    const posledni = volani[1].messages[volani[1].messages.length - 1]
    expect(JSON.stringify(posledni.content)).toMatch(/zruseno/)
    expect(await prisma.aiAuditLog.count({ where: { orgId: orgA.id, nastroj: 'add_note', stav: 'ZRUSENO' } })).toBe(1)
  })
})

describe('firemní kontext per tenant', () => {
  it('kontext jedné firmy se nedostane k jiné', async () => {
    const { nactiFiremniKontext } = await import('@/lib/ai/firemniKontext')
    await prisma.organization.update({ where: { id: orgA.id }, data: { aiContext: 'Tajný postup firmy A' } })
    try {
      expect(await nactiFiremniKontext(orgA.id)).toMatch(/FIREMNÍ KONTEXT[\s\S]*Tajný postup firmy A/)
      expect(await nactiFiremniKontext(orgB.id)).toBe('')
    } finally {
      await prisma.organization.update({ where: { id: orgA.id }, data: { aiContext: null } })
    }
  })
})

describe('historie: akce AI připsané uživateli', () => {
  it('poznámka k zakázce a klientovi se v historii označí jako AI (zdroj z kontextu)', async () => {
    await executeAiTool({ ...admin, zdroj: 'mcp' }, 'add_note', { zakazkaId: zakazkaA, text: 'Z auta' })
    const z = await prisma.auditLog.findFirst({ where: { orgId: orgA.id, zaznamId: zakazkaA, zmeny: { equals: { komentar: true } } }, orderBy: { vytvoreno: 'desc' } })
    expect(z).toMatchObject({ actorType: 'ai', aiSource: 'mcp', userId: admin.userId, typZaznamu: 'Zakazka' })

    await executeAiTool(admin, 'add_note', { klientId: klientA, text: 'Druhá' })
    const k = await prisma.auditLog.findFirst({ where: { orgId: orgA.id, zaznamId: klientA }, orderBy: { vytvoreno: 'desc' } })
    expect(k).toMatchObject({ actorType: 'ai', aiSource: 'web', typZaznamu: 'Client' })
  })

  it('neúspěšný zápis do historie nejde', async () => {
    const pred = await prisma.auditLog.count({ where: { orgId: orgA.id } })
    await executeAiTool(admin, 'add_note', { zakazkaId: zakazkaB, text: 'cizí' })
    expect(await prisma.auditLog.count({ where: { orgId: orgA.id } })).toBe(pred)
    expect(await prisma.auditLog.count({ where: { orgId: orgB.id } })).toBe(0)
  })
})
