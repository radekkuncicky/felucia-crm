import Anthropic from '@anthropic-ai/sdk'
import { orgPrisma } from '@/lib/orgPrisma'
import { dasaKredity } from '@/lib/dasaLimits'
import { nastrojeProKontext, executeAiTool, nahledAkce, needsConfirm, zapisAudit, cistyVstup } from './tools'
import type { AiKontext, AiNahledAkce } from './types'

/**
 * Smyčka tool use AI asistentky. Čtení se provádí hned; zápisy, které vyžadují
 * potvrzení, se neprovedou — stav konverzace se uloží do ai_cekajici_akce
 * a klient dostane kartu ke schválení. Po potvrzení (pokracujPoPotvrzeni)
 * se zápisy provedou a model pokračuje tam, kde přestal.
 */

export type AnthropicLike = { messages: Pick<Anthropic['messages'], 'create'> }

export interface AgentUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  toolCalls: number
}

export type AgentVysledek =
  | { typ: 'odpoved'; text: string; navigateTo?: string; usage: AgentUsage }
  | { typ: 'potvrzeni'; text: string; cekajiciId: string; akce: AiNahledAkce[]; navigateTo?: string; usage: AgentUsage }

const MAX_ITERATIONS = 8
const CEKANI_MS = 30 * 60 * 1000

let client: Anthropic | null = null
export function getAnthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return client
}

const novaUsage = (): AgentUsage => ({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, toolCalls: 0 })

/** Data z CRM ohraničená — model je má brát jako obsah, ne instrukce */
function toolResult(id: string, result: string): Anthropic.ToolResultBlockParam {
  return {
    type: 'tool_result',
    tool_use_id: id,
    content: `<data source="crm">\n${result.replace(/<\/data>/gi, '&lt;/data&gt;')}\n</data>`,
  }
}

function textZOdpovedi(content: Anthropic.ContentBlock[]) {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim()
}

interface CekajiciZapis { id: string; name: string; input: Record<string, unknown> }

export async function runAgent(p: {
  ctx: AiKontext
  model: string
  system: string
  messages: Anthropic.MessageParam[]
  anthropic?: AnthropicLike
  usage?: AgentUsage
  navigateTo?: string
}): Promise<AgentVysledek> {
  const anthropic = p.anthropic ?? getAnthropic()
  const usage = p.usage ?? novaUsage()
  const messages = [...p.messages]
  let navigateTo = p.navigateTo

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const res = await anthropic.messages.create({
      model: p.model,
      max_tokens: 4096,
      system: [{ type: 'text', text: p.system, cache_control: { type: 'ephemeral' } }],
      tools: nastrojeProKontext(p.ctx),
      messages,
    })

    usage.inputTokens += res.usage.input_tokens ?? 0
    usage.outputTokens += res.usage.output_tokens ?? 0
    usage.cacheReadTokens += res.usage.cache_read_input_tokens ?? 0

    if (res.stop_reason !== 'tool_use') {
      return { typ: 'odpoved', text: textZOdpovedi(res.content), navigateTo, usage }
    }

    messages.push({ role: 'assistant', content: res.content as Anthropic.ContentBlockParam[] })
    const toolUses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    usage.toolCalls += toolUses.length

    const hned = toolUses.filter(t => !needsConfirm(t.name))
    const kPotvrzeni = toolUses.filter(t => needsConfirm(t.name))

    const hotove = await Promise.all(hned.map(async t => {
      const r = await executeAiTool(p.ctx, t.name, t.input)
      if (r.navigateTo) navigateTo = r.navigateTo
      return toolResult(t.id, r.result)
    }))

    if (kPotvrzeni.length === 0) {
      messages.push({ role: 'user', content: hotove })
      continue
    }

    const akce: CekajiciZapis[] = kPotvrzeni.map(t => ({ id: t.id, name: t.name, input: cistyVstup(t.input) }))
    const cekajici = await orgPrisma(p.ctx.orgId).aiCekajiciAkce.create({
      data: {
        orgId: p.ctx.orgId,
        userId: p.ctx.userId,
        model: p.model,
        system: p.system,
        zpravy: messages as unknown as object,
        hotove: hotove as unknown as object,
        akce: akce as unknown as object,
        expiruje: new Date(Date.now() + CEKANI_MS),
      },
    })
    await Promise.all(akce.map(a => zapisAudit(p.ctx, { nastroj: a.name, vstup: a.input, stav: 'NAVRZENO' })))

    return {
      typ: 'potvrzeni',
      text: textZOdpovedi(res.content),
      cekajiciId: cekajici.id,
      akce: await Promise.all(akce.map(a => nahledAkce(p.ctx, a.name, a.input))),
      navigateTo,
      usage,
    }
  }

  return { typ: 'odpoved', text: '', navigateTo, usage }
}

export type PokracovaniVysledek =
  | { ok: false; chyba: string }
  | { ok: true; provedeno: { titulek: string; ok: boolean }[]; dalsi: AgentVysledek; model: string }

/**
 * Potvrzení / zrušení čekajících zápisů. Záznam se nejdřív atomicky „zabere"
 * (stav CEKA → POTVRZENO/ZRUSENO), takže dvojklik nebo souběžný požadavek
 * zápis neprovede dvakrát. Akce se berou z DB, ne od klienta.
 */
export async function pokracujPoPotvrzeni(p: {
  ctx: AiKontext
  cekajiciId: string
  potvrdit: boolean
  anthropic?: AnthropicLike
}): Promise<PokracovaniVysledek> {
  const db = orgPrisma(p.ctx.orgId)
  const where = { id: p.cekajiciId, orgId: p.ctx.orgId, userId: p.ctx.userId }

  const zabrano = await db.aiCekajiciAkce.updateMany({
    where: { ...where, stav: 'CEKA', expiruje: { gt: new Date() } },
    data: { stav: p.potvrdit ? 'POTVRZENO' : 'ZRUSENO' },
  })
  if (zabrano.count !== 1) return { ok: false, chyba: 'Návrh už neplatí (vypršel nebo byl vyřízen). Napiš to Dáše znovu.' }

  const row = await db.aiCekajiciAkce.findFirst({ where })
  if (!row) return { ok: false, chyba: 'Návrh nenalezen' }

  const akce = row.akce as unknown as CekajiciZapis[]
  const vysledky: Anthropic.ToolResultBlockParam[] = []
  const provedeno: { titulek: string; ok: boolean }[] = []
  let navigateTo: string | undefined

  // postupně, ne paralelně — pořadí zápisů může záležet (klient → OP)
  for (const a of akce) {
    if (!p.potvrdit) {
      await zapisAudit(p.ctx, { nastroj: a.name, vstup: a.input, stav: 'ZRUSENO' })
      vysledky.push(toolResult(a.id, JSON.stringify({ zruseno: true, zprava: 'Uživatel akci zrušil — nic se neprovedlo.' })))
      continue
    }
    const r = await executeAiTool(p.ctx, a.name, a.input, 'POTVRZENO')
    if (r.navigateTo) navigateTo = r.navigateTo
    let ok = true
    try { ok = !('chyba' in JSON.parse(r.result)) } catch { /* ne-JSON výsledek = ok */ }
    provedeno.push({ titulek: (await nahledAkce(p.ctx, a.name, a.input)).titulek, ok })
    vysledky.push(toolResult(a.id, r.result))
  }

  const messages = row.zpravy as unknown as Anthropic.MessageParam[]
  const hotove = row.hotove as unknown as Anthropic.ToolResultBlockParam[]
  messages.push({ role: 'user', content: [...hotove, ...vysledky] })

  const dalsi = await runAgent({
    ctx: p.ctx, model: row.model, system: row.system, messages, anthropic: p.anthropic, navigateTo,
  })
  return { ok: true, provedeno, dalsi, model: row.model }
}

/** Zápis spotřeby (AiUsageLog + kredity organizace); vrací kredity za dotaz */
export async function zapisSpotrebu(ctx: AiKontext, model: string, usage: AgentUsage): Promise<number> {
  const db = orgPrisma(ctx.orgId)
  const credits = dasaKredity(usage.inputTokens, usage.outputTokens, usage.cacheReadTokens)
  await Promise.all([
    db.aiUsageLog.create({
      data: {
        orgId: ctx.orgId, userId: ctx.userId,
        inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens, toolCalls: usage.toolCalls, credits, model,
      },
    }),
    db.organization.update({
      where: { id: ctx.orgId },
      data: { aiTokensUsed: { increment: 1 }, aiCreditsUsed: { increment: credits } },
    }),
  ])
  return credits
}

/** Dáša odpovídá JSONem { message, quickReplies } — vytáhne ho, jinak vrátí text */
export function parseDasaOdpoved(rawText: string): { message: string; quickReplies: string[] } {
  const stripped = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  const jsonStr = stripped.startsWith('{') ? stripped : (stripped.match(/\{[\s\S]*\}/) ?? [null])[0]
  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr)
      if (parsed.message !== undefined) {
        return {
          message: String(parsed.message),
          quickReplies: Array.isArray(parsed.quickReplies) ? parsed.quickReplies.slice(0, 3).map(String) : [],
        }
      }
    } catch { /* plain text fallback */ }
  }
  return { message: rawText, quickReplies: [] }
}
