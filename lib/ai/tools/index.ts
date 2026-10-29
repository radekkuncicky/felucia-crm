import { orgPrisma } from '@/lib/orgPrisma'
import { formatDate, formatKc } from '@/lib/format'
import { DASA_TOOLS, executeDasaTool } from '@/lib/dasaTools'
import { ZAKAZKA_TOOLS, ZAKAZKA_TOOL_NAMES, executeZakazkaTool, popisZakazkaAkce } from './zakazky'
import { ANALYTIKA_TOOLS, ANALYTIKA_TOOL_NAMES, executeAnalytikaTool } from './analytika'
import { PIPELINE_TOOLS, PIPELINE_TOOL_NAMES, executePipelineTool } from './pipeline'
import type { AiKontext, AiNahledAkce, AiToolResult } from '../types'

/**
 * Jediný registr nástrojů AI asistentky — používá ho webová Dáša
 * (app/api/ai-assistant) a později i MCP konektor. Každý nástroj dostává
 * kontext ze serveru (AiKontext); orgId od modelu se zahazuje.
 */

export const AI_TOOLS = [...DASA_TOOLS, ...ZAKAZKA_TOOLS, ...ANALYTIKA_TOOLS, ...PIPELINE_TOOLS]

/** Zápisy, které se provedou až po potvrzení uživatelem (karta Potvrdit / Zrušit) */
export const CONFIRM_TOOLS = new Set([
  'create_quote', 'create_deal', 'create_client', 'add_activity', 'change_deal_status', 'create_lead',
  'update_order_status', 'add_note',
])

/**
 * Zápisy bez potvrzení. pripojit_diktat jen přesune uživatelův vlastní diktát
 * k leadu / OP, který uživatel v předchozím kroku potvrdil — druhá karta by
 * byla jen zdržení.
 */
export const WRITE_TOOLS = new Set([...Array.from(CONFIRM_TOOLS), 'pripojit_diktat'])

// Zápisy obchodu (OP, nabídky, klienti, leady) — bez práva obchodu je asistentka vůbec nenabízí
const OBCHOD_ZAPISY = new Set(['create_quote', 'create_deal', 'create_client', 'change_deal_status', 'create_lead'])

/**
 * Nástroje podle oprávnění uživatele: zápisy, které by handler stejně odmítl,
 * model vůbec nedostane (méně slepých pokusů). Handlery práva hlídají dál.
 */
export function nastrojeProKontext(ctx: AiKontext) {
  return AI_TOOLS.filter(t => {
    // analytika obchodu jen v konektoru (Claude) — webové Dáše by jen zvětšila prompt
    if (ANALYTIKA_TOOL_NAMES.has(t.name) || PIPELINE_TOOL_NAMES.has(t.name)) return ctx.zdroj === 'mcp' && ctx.perms.obchod
    if (OBCHOD_ZAPISY.has(t.name)) return ctx.perms.obchod
    if (t.name === 'update_order_status') return ctx.perms.zakazkyEdit
    return true
  })
}

export function isWriteTool(name: string) {
  return WRITE_TOOLS.has(name)
}

export function needsConfirm(name: string) {
  return CONFIRM_TOOLS.has(name)
}

const TENANT_KEY = /^(org|tenant)[_-]?id$/i

/** Vstup od modelu bez klíčů tenanta — tenant se bere výhradně z kontextu */
export function cistyVstup(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return Object.fromEntries(Object.entries(input as Record<string, unknown>).filter(([k]) => !TENANT_KEY.test(k)))
}

const logPrefix = (ctx: AiKontext) => (ctx.zdroj === 'mcp' ? '[ai-mcp]' : '[ai-chat]')

export async function zapisAudit(
  ctx: AiKontext,
  p: { nastroj: string; vstup: Record<string, unknown>; vysledek?: string | null; stav: string },
) {
  try {
    await orgPrisma(ctx.orgId).aiAuditLog.create({
      data: {
        orgId: ctx.orgId,
        userId: ctx.userId,
        zdroj: ctx.zdroj,
        nastroj: p.nastroj,
        vstup: p.vstup as object,
        vysledek: p.vysledek?.slice(0, 20000) ?? null,
        stav: p.stav,
      },
    })
  } catch (err) {
    // audit nesmí shodit odpověď asistentky
    console.error(`${logPrefix(ctx)} audit log selhal:`, err)
  }
}

type HistorieZaznam = { typAkce: 'CREATE' | 'UPDATE'; typZaznamu: string; zaznamId: string; zaznamNazev: string; zmeny?: Record<string, unknown> }

/** Úspěšný zápis asistentky → záznam v historii (audit_logs) s actorType "ai", připsaný uživateli */
function historieZapisu(name: string, input: Record<string, unknown>, r: Record<string, unknown>): HistorieZaznam | null {
  const id = (v: unknown) => (typeof v === 'string' && v ? v : null)
  switch (name) {
    case 'create_deal':
      return !id(r.dealId) ? null : { typAkce: 'CREATE', typZaznamu: 'Deal', zaznamId: r.dealId as string, zaznamNazev: String(r.kod ?? '') }
    case 'create_client':
      return !id(r.clientId) ? null : { typAkce: 'CREATE', typZaznamu: 'Client', zaznamId: r.clientId as string, zaznamNazev: String(r.nazev ?? '') }
    case 'create_quote':
      return !id(r.quoteId) ? null : { typAkce: 'CREATE', typZaznamu: 'Quote', zaznamId: r.quoteId as string, zaznamNazev: String(r.kod ?? r.nazev ?? '') }
    case 'add_activity':
      return !id(r.activityId) ? null : { typAkce: 'CREATE', typZaznamu: 'Activity', zaznamId: r.activityId as string, zaznamNazev: String(r.kod ?? ''), zmeny: { typ: input.typ } }
    case 'change_deal_status':
      return !id(input.dealId) ? null : { typAkce: 'UPDATE', typZaznamu: 'Deal', zaznamId: input.dealId as string, zaznamNazev: '', zmeny: { stav: r.novyStav } }
    case 'create_lead':
      return !id(r.leadId) ? null : { typAkce: 'CREATE', typZaznamu: 'Lead', zaznamId: r.leadId as string, zaznamNazev: String(input.jmeno ?? '') }
    case 'add_note':
      if (id(r.zakazkaId)) return { typAkce: 'UPDATE', typZaznamu: 'Zakazka', zaznamId: r.zakazkaId as string, zaznamNazev: String(r.cislo ?? ''), zmeny: { komentar: true } }
      if (id(r.klientId)) return { typAkce: 'UPDATE', typZaznamu: 'Client', zaznamId: r.klientId as string, zaznamNazev: '', zmeny: { poznamka: true } }
      return null
    // update_order_status zapisuje historii sám (lib/zakazkaStav.ts)
    default:
      return null
  }
}

async function zapisHistoriiAi(ctx: AiKontext, name: string, input: Record<string, unknown>, result: string) {
  let r: Record<string, unknown>
  try { r = JSON.parse(result) } catch { return }
  const h = historieZapisu(name, input, r)
  if (!h) return
  try {
    await orgPrisma(ctx.orgId).auditLog.create({
      data: { orgId: ctx.orgId, userId: ctx.userId, ...h, zmeny: (h.zmeny ?? {}) as object, actorType: 'ai', aiSource: ctx.zdroj },
    })
  } catch (err) {
    console.error(`${logPrefix(ctx)} historie ${name} selhala:`, err)
  }
}

function vypadaJakoChyba(result: string) {
  try {
    const r = JSON.parse(result)
    return !!r && typeof r === 'object' && 'chyba' in r
  } catch {
    return false
  }
}

/**
 * Provede nástroj a zapíše ho do ai_audit_logs.
 * `stav` = PROVEDENO pro čtení / zápis bez potvrzení, POTVRZENO pro potvrzený zápis.
 */
export async function executeAiTool(
  ctx: AiKontext,
  name: string,
  rawInput: unknown,
  stav: 'PROVEDENO' | 'POTVRZENO' = 'PROVEDENO',
): Promise<AiToolResult> {
  const input = cistyVstup(rawInput)
  const t0 = Date.now()
  let out: AiToolResult
  try {
    out = ZAKAZKA_TOOL_NAMES.has(name)
      ? await executeZakazkaTool(ctx, name, input)
      : ANALYTIKA_TOOL_NAMES.has(name)
      ? await executeAnalytikaTool(ctx, name, input)
      : PIPELINE_TOOL_NAMES.has(name)
      ? await executePipelineTool(ctx, name, input)
      : await executeDasaTool(name, input, { id: ctx.userId, orgId: ctx.orgId, role: ctx.role, jmeno: ctx.jmeno, perms: ctx.perms })
  } catch (err) {
    console.error(`${logPrefix(ctx)} nástroj ${name} selhal:`, err)
    out = { result: JSON.stringify({ chyba: 'Interní chyba nástroje' }) }
  }
  const failed = vypadaJakoChyba(out.result)
  console.log(`${logPrefix(ctx)} ${name} org=${ctx.orgId} user=${ctx.userId} ${failed ? 'CHYBA' : stav} ${Date.now() - t0}ms`)
  await zapisAudit(ctx, { nastroj: name, vstup: input, vysledek: out.result, stav: failed ? 'CHYBA' : stav })
  if (!failed && isWriteTool(name)) await zapisHistoriiAi(ctx, name, input, out.result)
  return out
}

// ─── Náhledy zápisů pro potvrzovací kartu ────────────────────────────────────

const TYP_AKTIVITY: Record<string, string> = {
  HOVOR: 'Hovor', EMAIL: 'E-mail', SCHUZKA: 'Schůzka', UKOL: 'Úkol', POZNAMKA: 'Poznámka',
}

const s = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim())

async function dealPopis(ctx: AiKontext, dealId: unknown) {
  const id = s(dealId)
  if (!id) return '?'
  const d = await orgPrisma(ctx.orgId).deal.findFirst({
    where: { orgId: ctx.orgId, OR: [{ id }, { kod: id }] },
    select: { kod: true, predmet: true, client: { select: { jmeno: true, prijmeni: true } } },
  })
  if (!d) return id
  const klient = d.client ? `${d.client.jmeno} ${d.client.prijmeni ?? ''}`.trim() : ''
  return [d.kod, d.predmet, klient].filter(Boolean).join(' — ')
}

/** Lidsky čitelné shrnutí zápisu (bez ID), které uživatel potvrzuje */
export async function nahledAkce(ctx: AiKontext, name: string, rawInput: unknown): Promise<AiNahledAkce> {
  const input = cistyVstup(rawInput)
  try {
    switch (name) {
      case 'create_quote': {
        const items = Array.isArray(input.items) ? (input.items as Record<string, unknown>[]) : []
        const celkem = items.reduce((sum, i) => sum + (Number(i.mnozstvi) || 0) * (Number(i.cenaZaKus) || 0), 0)
        return {
          titulek: 'Vytvořit cenovou nabídku',
          radky: [
            await dealPopis(ctx, input.dealId),
            `${s(input.nazev) || 'Varianta A'} · ${items.length} položek · ${formatKc(celkem)} bez DPH`,
          ],
        }
      }
      case 'create_deal': {
        const k = await orgPrisma(ctx.orgId).client.findFirst({
          where: { id: s(input.clientId), orgId: ctx.orgId }, select: { jmeno: true, prijmeni: true },
        })
        return {
          titulek: 'Založit obchodní případ',
          radky: [k ? `${k.jmeno} ${k.prijmeni}`.trim() : '?', [s(input.technologie), s(input.predmet)].filter(Boolean).join(' — ')],
        }
      }
      case 'create_client':
        return {
          titulek: 'Založit klienta',
          radky: [`${s(input.jmeno)} ${s(input.prijmeni)}`.trim(), [s(input.telefon), s(input.email)].filter(Boolean).join(' · ')].filter(Boolean),
        }
      case 'add_activity': {
        const datum = new Date(s(input.datum))
        return {
          titulek: `Přidat aktivitu: ${TYP_AKTIVITY[s(input.typ)] ?? s(input.typ)}`,
          radky: [await dealPopis(ctx, input.dealId), isNaN(datum.getTime()) ? '' : formatDate(datum), s(input.popis)].filter(Boolean),
        }
      }
      case 'change_deal_status':
        return {
          titulek: 'Změnit stav obchodního případu',
          radky: [await dealPopis(ctx, input.dealId), `→ ${s(input.stav)}${input.duvodProhryKod ? ` (${s(input.duvodProhryKod)})` : ''}`],
        }
      case 'create_lead':
        return {
          titulek: 'Založit lead',
          radky: [[s(input.jmeno), s(input.firma)].filter(Boolean).join(', '), [s(input.telefon), s(input.email)].filter(Boolean).join(' · '), s(input.zprava)].filter(Boolean),
        }
      case 'update_order_status':
      case 'add_note':
        return await popisZakazkaAkce(ctx, name, input)
    }
  } catch (err) {
    console.error(`${logPrefix(ctx)} náhled ${name} selhal:`, err)
  }
  return { titulek: name, radky: [] }
}
