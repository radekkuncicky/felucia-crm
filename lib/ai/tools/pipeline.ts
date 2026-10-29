import type { Prisma } from '@prisma/client'
import { orgPrisma } from '@/lib/orgPrisma'
import { quoteCelkemBezDph } from '@/lib/quoteMath'
import { TECHNOLOGIE, type Technologie, dnyMezi, isoDen, nactiOp, parseDen, posunDny, scopeOp, type OpAnalyza } from './analytika'
import type { AiKontext, AiToolResult } from '../types'

// ─── Pipeline a časová osa OP pro MCP (jen čtení) ────────────────────────────

const OTEVRENE = ['NOVY', 'JEDNANI', 'NABIDKA', 'PRED_UZAVRENIM'] as const
const K_URGENCI = new Set(['NABIDKA', 'PRED_UZAVRENIM'])
const DNY_BEZ_AKTIVITY = 7

export const PIPELINE_TOOLS = [
  {
    name: 'pipeline_snapshot',
    description:
      'Stav rozpracovaného obchodu k datu: pro každý otevřený stav OP (nový, jednání, nabídka, před uzavřením) počet, součet hodnot nabídek, ' +
      'průměrné a maximální stáří ve stavu a 5 nejdéle visících OP. Sekce k_urgenci: nabídky bez aktivity déle než 7 dní (podle hodnoty) a úkoly po termínu. ' +
      'Použij na otázky „co mám v pipeline“, „co hoří“, „na co zapomínáme“.',
    input_schema: {
      type: 'object' as const,
      properties: {
        k_datu: { type: 'string', description: 'YYYY-MM-DD, výchozí dnes' },
        obchodnikId: { type: 'string', description: 'ID obchodníka (z list_deals / sales_stats)' },
        technologie: { type: 'string', enum: [...TECHNOLOGIE] },
      },
    },
  },
  {
    name: 'deal_timeline',
    description: 'Časová osa jednoho OP: změny stavů (kdo a kdy), aktivity, nabídky a poznámky z leadu chronologicky v jednom seznamu.',
    input_schema: {
      type: 'object' as const,
      properties: { dealId: { type: 'string', description: 'ID nebo kód OP (např. OP-26-081)' } },
      required: ['dealId'],
    },
  },
]

export const PIPELINE_TOOL_NAMES = new Set(PIPELINE_TOOLS.map(t => t.name))

const ok = (data: unknown): AiToolResult => ({ result: JSON.stringify(data) })
const chyba = (text: string): AiToolResult => ({ result: JSON.stringify({ chyba: text }) })

/** Stav OP k okamžiku a kdy do něj vstoupil (historie už je oříznutá k datu) */
function stavK(op: OpAnalyza) {
  const posl = op.historie[op.historie.length - 1]
  return posl ? { stav: posl.stav, od: posl.kdy } : { stav: op.stav, od: op.zalozeno }
}

const prumer = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null)

/** Data pipeline_snapshot — sdílí je i weekly_report (sekce k urgenci) */
export async function pipelineStav(ctx: AiKontext, input: Record<string, unknown>, now: Date) {
  const den = parseDen(input.k_datu) ?? parseDen(isoDen(now))!
  // konec zvoleného dne (dnes = teď), aby se počítaly i dnešní změny
  const konec = input.k_datu ? posunDny(den, 1) : now
  const where: Prisma.DealWhereInput = { vytvoreno: { lt: konec } }
  if (typeof input.obchodnikId === 'string' && input.obchodnikId) where.userId = input.obchodnikId
  if (TECHNOLOGIE.includes(input.technologie as Technologie)) where.technologie = input.technologie as Technologie

  const opy = (await nactiOp(ctx, where, konec))
    .map(op => ({ op, ...stavK(op) }))
    .filter(x => (OTEVRENE as readonly string[]).includes(x.stav))
    .map(x => ({
      ...x,
      dniVeStavu: dnyMezi(x.od, konec),
      dniBezAktivity: dnyMezi(x.op.posledniAktivita ?? x.op.zalozeno, konec),
    }))

  const radek = (x: (typeof opy)[number]) => ({
    kod: x.op.kod, klient: x.op.klient, obchodnik: x.op.obchodnik, hodnotaBezDph: x.op.hodnotaBezDph,
    dniVeStavu: x.dniVeStavu, dniBezAktivity: x.dniBezAktivity,
  })

  const stavy = OTEVRENE.map(stav => {
    const v = opy.filter(x => x.stav === stav)
    return {
      stav,
      pocet: v.length,
      hodnotaBezDph: Math.round(v.reduce((s, x) => s + (x.op.hodnotaBezDph ?? 0), 0)),
      bezNabidky: v.filter(x => x.op.hodnotaBezDph === null).length,
      prumerDniVeStavu: prumer(v.map(x => x.dniVeStavu)),
      maxDniVeStavu: v.length ? Math.max(...v.map(x => x.dniVeStavu)) : null,
      nejdeleVisici: [...v].sort((a, b) => b.dniVeStavu - a.dniVeStavu).slice(0, 5).map(radek),
    }
  })

  const nabidky = opy
    .filter(x => K_URGENCI.has(x.stav) && x.dniBezAktivity > DNY_BEZ_AKTIVITY)
    .sort((a, b) => (b.op.hodnotaBezDph ?? 0) - (a.op.hodnotaBezDph ?? 0))

  // úkoly po termínu: naplánované aktivity s datem před začátkem dne
  const db = orgPrisma(ctx.orgId)
  const ukolyWhere: Prisma.ActivityWhereInput = {
    orgId: ctx.orgId, stav: 'PLANOVANA', datum: { lt: den },
    ...(ctx.perms.obchodCiziOP ? {} : { OR: [{ resitelId: ctx.userId }, { resitelId: null, userId: ctx.userId }] }),
    ...(typeof input.obchodnikId === 'string' && input.obchodnikId ? { resitelId: input.obchodnikId } : {}),
  }
  const [pocetUkolu, ukoly] = await Promise.all([
    db.activity.count({ where: ukolyWhere }),
    db.activity.findMany({
      where: ukolyWhere,
      select: {
        typ: true, popis: true, datum: true,
        resitel: { select: { jmeno: true } }, user: { select: { jmeno: true } },
        deal: { select: { kod: true } }, lead: { select: { jmeno: true } },
      },
      orderBy: { datum: 'asc' },
      take: 20,
    }),
  ])

  return {
    kDatu: isoDen(den),
    otevreno: { pocet: opy.length, hodnotaBezDph: Math.round(opy.reduce((s, x) => s + (x.op.hodnotaBezDph ?? 0), 0)) },
    stavy,
    k_urgenci: {
      nabidkyBezAktivity: { pocet: nabidky.length, polozky: nabidky.slice(0, 20).map(x => ({ ...radek(x), stav: x.stav })) },
      ukolyPoTerminu: {
        pocet: pocetUkolu,
        polozky: ukoly.map(u => ({
          typ: u.typ, popis: u.popis?.slice(0, 200) ?? null, termin: isoDen(u.datum), dniPoTerminu: dnyMezi(parseDen(isoDen(u.datum))!, den),
          resitel: u.resitel?.jmeno ?? u.user?.jmeno ?? null, op: u.deal?.kod ?? null, lead: u.lead?.jmeno ?? null,
        })),
      },
    },
    poznamka: `Hodnota = aktivní nabídka (dnešní, i u data v minulosti). Stáří ve stavu z historie stavů (sahá do 30. 3. 2026). „Bez aktivity" = od poslední dokončené aktivity nebo poznámky k OP, jinak od založení; urgence nad ${DNY_BEZ_AKTIVITY} dní.${ctx.perms.obchodCiziOP ? '' : ' Jen tvoje OP a úkoly.'}`,
  }
}

async function dealTimeline(ctx: AiKontext, input: Record<string, unknown>): Promise<AiToolResult> {
  const id = String(input.dealId ?? '').trim()
  if (!id) return chyba('Chybí dealId')
  const db = orgPrisma(ctx.orgId)
  const deal = await db.deal.findFirst({
    where: { orgId: ctx.orgId, OR: [{ id }, { kod: id }], AND: [scopeOp(ctx)] },
    select: {
      id: true, kod: true, predmet: true, stav: true, vytvoreno: true, poznamky: true,
      client: { select: { jmeno: true, prijmeni: true } },
      stavZmeny: { select: { zStavu: true, naStav: true, vytvoreno: true, zmenil: { select: { jmeno: true } } } },
      activities: {
        select: { typ: true, popis: true, vysledek: true, datum: true, stav: true, user: { select: { jmeno: true } }, resitel: { select: { jmeno: true } } },
      },
      quotes: {
        select: { kod: true, nazev: true, aktivni: true, vytvoreno: true, odeslanoAt: true, stav: true, items: { select: { mnozstvi: true, cenaZaKus: true, sleva: true } } },
      },
      lead: { select: { vytvoreno: true, jmeno: true, zprava: true, notes: { select: { text: true, vytvoreno: true, user: { select: { jmeno: true } } } } } },
    },
  })
  if (!deal) return chyba('OP nenalezen nebo nemáš přístup')

  type Udalost = { kdy: Date; typ: string; [k: string]: unknown }
  const osa: Udalost[] = []
  if (deal.lead) osa.push({ kdy: deal.lead.vytvoreno, typ: 'lead', text: deal.lead.zprava?.slice(0, 500) ?? null })
  for (const n of deal.lead?.notes ?? []) osa.push({ kdy: n.vytvoreno, typ: 'poznamka', kdo: n.user.jmeno, text: n.text.slice(0, 500) })
  for (const z of deal.stavZmeny) {
    osa.push(z.zStavu === null
      ? { kdy: z.vytvoreno, typ: 'zalozeni', stav: z.naStav, kdo: z.zmenil?.jmeno ?? null }
      : { kdy: z.vytvoreno, typ: 'zmena_stavu', z: z.zStavu, na: z.naStav, kdo: z.zmenil?.jmeno ?? null })
  }
  for (const a of deal.activities) {
    osa.push({
      kdy: a.datum, typ: 'aktivita', druh: a.typ, stav: a.stav, kdo: a.resitel?.jmeno ?? a.user?.jmeno ?? null,
      text: a.popis?.slice(0, 500) ?? null, vysledek: a.vysledek?.slice(0, 500) ?? null,
    })
  }
  for (const q of deal.quotes) {
    osa.push({
      kdy: q.vytvoreno, typ: 'nabidka', kod: q.kod, nazev: q.nazev, aktivni: q.aktivni,
      hodnotaBezDph: Math.round(quoteCelkemBezDph(q.items)), odeslano: isoDen(q.odeslanoAt),
    })
  }
  if (!deal.stavZmeny.some(z => z.zStavu === null)) osa.push({ kdy: deal.vytvoreno, typ: 'zalozeni' })
  osa.sort((a, b) => a.kdy.getTime() - b.kdy.getTime())

  return ok({
    kod: deal.kod, predmet: deal.predmet, stav: deal.stav,
    klient: deal.client ? `${deal.client.jmeno} ${deal.client.prijmeni}`.trim() : null,
    poznamkyOp: deal.poznamky?.slice(0, 1000) ?? null,
    udalosti: osa.slice(-200).map(({ kdy, ...u }) => ({ datum: isoDen(kdy), ...u })),
    odkaz: `/deals/${deal.id}`,
  })
}

export async function executePipelineTool(ctx: AiKontext, name: string, input: Record<string, unknown>, now = new Date()): Promise<AiToolResult> {
  if (!ctx.perms.obchod) return chyba('Nemáš přístup k obchodu')
  const t0 = Date.now()
  const out = name === 'pipeline_snapshot' ? ok(await pipelineStav(ctx, input, now))
    : name === 'deal_timeline' ? await dealTimeline(ctx, input)
    : chyba(`Neznámý nástroj: ${name}`)
  console.log(`[mcp-pipeline] ${name} org=${ctx.orgId} user=${ctx.userId} ${Date.now() - t0}ms`)
  return out
}
