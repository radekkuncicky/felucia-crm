import type { Prisma } from '@prisma/client'
import { orgPrisma } from '@/lib/orgPrisma'
import { zakazkyScopeWhere } from '@/lib/permissions'
import { montazeVRozsahu } from '@/lib/montazeVRozsahu'
import {
  dnyMezi, isoDen, metriky, nactiOp, nactiUdalosti, obdobi, parseDen, posunDny, vObdobi, zaokr, type OpAnalyza,
} from './analytika'
import { pipelineStav } from './pipeline'
import {
  ZAKAZKA_ANALYZA_SELECT, hodnotaZakazky, rozsahMontaze, vyuctovanoZakazky, zakazkaVystup, type ZakazkaAnalyza,
} from './zakazky'
import type { AiKontext, AiToolResult } from '../types'

// ─── Provoz (zakázky, montáže, technici) + týdenní report pro MCP (jen čtení) ─
//
// Termíny montáží jsou UTC půlnoc daného dne (jako kalendář), období od/do
// z analytiky jsou pražské půlnoci — porovnává se přes řetězce YYYY-MM-DD.

const ROZPRACOVANE = new Set(['NOVA', 'PRIRAZENA', 'V_REALIZACI'])

export const PROVOZ_TOOLS = [
  {
    name: 'operations_stats',
    description:
      'Statistiky realizace za období: dokončené zakázky a jejich objem, průměrná doba od vyhrání OP po montáž, ' +
      'vytížení techniků (montážní dny na technika) a zakázky po termínu montáže. Volitelně srovnání s předchozím obdobím. ' +
      'Použij na „kolik jsme toho v říjnu namontovali“, „kdo je nejvytíženější“, „co se zdržuje“.',
    input_schema: {
      type: 'object' as const,
      properties: {
        od: { type: 'string', description: 'Začátek období YYYY-MM-DD (včetně), výchozí 1. den tohoto měsíce' },
        do: { type: 'string', description: 'Konec období YYYY-MM-DD (včetně), výchozí dnes' },
        porovnat_s_predchozim: { type: 'boolean', description: 'Přidat stejné metriky za předchozí stejně dlouhé období' },
      },
    },
  },
  {
    name: 'weekly_report',
    description:
      'Týdenní report bez parametrů: posledních 7 dní proti předchozím 7 — nové leady a OP, vyhrané a prohrané OP s hodnotami, ' +
      'nabídky k urgenci, úkoly po termínu, montáže na příští týden a dokončené zakázky. Použij na „jak jsme na tom tento týden“ nebo pondělní shrnutí.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'help_analytics',
    description: 'Přehled analytických nástrojů Felucie a doporučené postupy (měsíční report, týdenní porada, kontrola pipeline). Zavolej, když nevíš, kterým nástrojem začít.',
    input_schema: { type: 'object' as const, properties: {} },
  },
]

export const PROVOZ_TOOL_NAMES = new Set(PROVOZ_TOOLS.map(t => t.name))

const ok = (data: unknown): AiToolResult => ({ result: JSON.stringify(data) })
const chyba = (text: string): AiToolResult => ({ result: JSON.stringify({ chyba: text }) })

type Obdobi = { od: Date; do: Date }
/** Období jako dny YYYY-MM-DD včetně */
const dnyObdobi = (o: Obdobi) => ({ od: isoDen(o.od)!, do: isoDen(new Date(o.do.getTime() - 1))! })

/** Dny od–do (YYYY-MM-DD včetně) */
function dnyVRozsahu(od: string, doo: string): string[] {
  const out: string[] = []
  for (let t = new Date(`${od}T00:00:00Z`); t <= new Date(`${doo}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + 1)) {
    out.push(t.toISOString().slice(0, 10))
  }
  return out
}

const pracovniDny = (od: string, doo: string) => dnyVRozsahu(od, doo).filter(d => ![0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())).length

async function nactiZakazky(ctx: AiKontext, scope: Record<string, unknown>) {
  return orgPrisma(ctx.orgId).zakazka.findMany({
    where: { orgId: ctx.orgId, AND: [scope as Prisma.ZakazkaWhereInput] },
    select: ZAKAZKA_ANALYZA_SELECT,
  })
}

/** Montážní dny na technika v období (den se počítá jednou, i když má technik víc zakázek) */
async function vytizeni(ctx: AiKontext, scope: Record<string, unknown>, o: Obdobi) {
  const { od, do: doo } = dnyObdobi(o)
  const montaze = await montazeVRozsahu(orgPrisma(ctx.orgId), { orgId: ctx.orgId, scope, od, do: doo })
  const technici = new Map<string, { jmeno: string; dny: Set<string>; zakazky: Set<string> }>()
  for (const m of montaze) {
    const dny = dnyVRozsahu(m.od < od ? od : m.od, m.do > doo ? doo : m.do)
    for (const t of [m.hlavniTechnik, ...m.technici].filter(Boolean) as { id: string; jmeno: string }[]) {
      if (!technici.has(t.id)) technici.set(t.id, { jmeno: t.jmeno, dny: new Set(), zakazky: new Set() })
      const x = technici.get(t.id)!
      dny.forEach(d => x.dny.add(d))
      x.zakazky.add(m.zakazkaId)
    }
  }
  const pracovni = pracovniDny(od, doo)
  return {
    pracovnichDnuVObdobi: pracovni,
    montaziBezTechnika: montaze.filter(m => !m.hlavniTechnik).length,
    technici: Array.from(technici, ([id, x]) => ({
      id, jmeno: x.jmeno, montaznichDni: x.dny.size, zakazek: x.zakazky.size,
      vytizeniProc: pracovni ? zaokr((x.dny.size / pracovni) * 100) : null,
    })).sort((a, b) => b.montaznichDni - a.montaznichDni),
  }
}

function provozMetriky(zakazky: ZakazkaAnalyza[], o: Obdobi, finance: boolean) {
  const { od, do: doo } = dnyObdobi(o)
  const dokoncene = zakazky.filter(z => z.stav === 'HOTOVO' && vObdobi(z.uzavreno, o))
  // doba od výhry OP po první den montáže — zakázky, jejichž montáž začala v období
  const doby = zakazky.flatMap(z => {
    const m = rozsahMontaze(z)
    const vyhra = isoDen(z.op?.vyhrano)
    if (!m || !vyhra || m.od < od || m.od > doo) return []
    return [dnyMezi(parseDen(vyhra)!, parseDen(m.od)!)]
  }).filter(d => d >= 0)
  const objem = (z: ZakazkaAnalyza) => vyuctovanoZakazky(z) || hodnotaZakazky(z) || 0
  return {
    dokonceneZakazky: dokoncene.length,
    ...(finance ? { objemDokoncenychBezDph: Math.round(dokoncene.reduce((s, z) => s + objem(z), 0)) } : {}),
    zahajeneMontaze: doby.length,
    prumerDniOdVyhryOpPoMontaz: doby.length ? zaokr(doby.reduce((s, d) => s + d, 0) / doby.length, 1) : null,
  }
}

/** Rozpracované zakázky, jejichž poslední den montáže už minul */
function poTerminu(zakazky: ZakazkaAnalyza[], dnes: string, finance: boolean) {
  return zakazky
    .flatMap(z => {
      const m = rozsahMontaze(z)
      return ROZPRACOVANE.has(z.stav) && m && m.do < dnes ? [{ z, dni: dnyMezi(parseDen(m.do)!, parseDen(dnes)!) }] : []
    })
    .sort((a, b) => b.dni - a.dni)
    .map(({ z, dni }) => ({ ...zakazkaVystup(z, finance, dnes), dniPoTerminu: dni }))
}

async function operationsStats(ctx: AiKontext, scope: Record<string, unknown>, input: Record<string, unknown>, now: Date) {
  const o = obdobi(input, now)
  if (typeof o === 'string') return chyba(o)
  const finance = ctx.perms.financeProdejni
  const dnes = isoDen(now)!
  const zakazky = await nactiZakazky(ctx, scope)
  const po = poTerminu(zakazky, dnes, finance)
  const out: Record<string, unknown> = {
    obdobi: dnyObdobi(o),
    celkem: provozMetriky(zakazky, o, finance),
    vytizeniTechniku: await vytizeni(ctx, scope, o),
    zakazkyPoTerminu: { pocet: po.length, polozky: po.slice(0, 20) },
  }
  if (input.porovnat_s_predchozim === true) {
    const dni = Math.round((o.do.getTime() - o.od.getTime()) / 86_400_000)
    const pred = { od: posunDny(o.od, -dni), do: o.od }
    out.predchozi = { obdobi: dnyObdobi(pred), celkem: provozMetriky(zakazky, pred, finance), vytizeniTechniku: await vytizeni(ctx, scope, pred) }
  }
  out.poznamka = [
    'Dokončené = stav Hotovo s datem uzavření v období.',
    finance ? 'Objem = schválená vyúčtování bez DPH, jinak aktivní nabídka OP.' : '',
    'Doba od výhry = zakázky, jejichž první montážní den je v období. Vytížení = různé montážní dny technika (zakázky i etapy jako v kalendáři) proti pracovním dnům.',
    `Po termínu = stav Nová/Přiřazená/V realizaci a poslední den montáže před dneškem (${dnes}).`,
  ].filter(Boolean).join(' ')
  return ok(out)
}

// ─── weekly_report ──────────────────────────────────────────────────────────

const opRadek = (op: OpAnalyza) => ({
  kod: op.kod, klient: op.klient, technologie: op.technologie, obchodnik: op.obchodnik, hodnotaBezDph: op.hodnotaBezDph,
  ...(op.stav === 'PAS' ? { duvodProhry: op.duvodProhryKod ?? op.duvodProhry } : {}),
})

async function weeklyReport(ctx: AiKontext, now: Date): Promise<AiToolResult> {
  const dnes = parseDen(isoDen(now))!
  const tyden = { od: posunDny(dnes, -6), do: posunDny(dnes, 1) }
  const minuly = { od: posunDny(dnes, -13), do: tyden.od }
  const out: Record<string, unknown> = { tyden: dnyObdobi(tyden), minulyTyden: dnyObdobi(minuly) }

  if (ctx.perms.obchod) {
    const opy = await nactiOp(ctx, {}, now)
    const [u, p] = await Promise.all([nactiUdalosti(ctx, tyden, opy), nactiUdalosti(ctx, minuly, opy)])
    const [m, mp] = [metriky(u), metriky(p)]
    const pipeline = await pipelineStav(ctx, {}, now)
    out.obchod = {
      noveLeady: { tento: m.noveLeady, minuly: mp.noveLeady },
      noveOp: { tento: m.noveOp, minuly: mp.noveOp },
      vyhrane: { tento: m.vyhrane, minuly: mp.vyhrane, objemBezDph: m.objemVyhranychBezDph, objemMinulyBezDph: mp.objemVyhranychBezDph },
      prohrane: { tento: m.prohrane, minuly: mp.prohrane },
      vyhraneOp: u.uzavrene.filter(o => o.stav === 'USPECH').map(opRadek),
      prohraneOp: u.uzavrene.filter(o => o.stav === 'PAS').map(opRadek),
      nabidkyKUrgenci: { pocet: pipeline.k_urgenci.nabidkyBezAktivity.pocet, polozky: pipeline.k_urgenci.nabidkyBezAktivity.polozky.slice(0, 10) },
      ukolyPoTerminu: { pocet: pipeline.k_urgenci.ukolyPoTerminu.pocet, polozky: pipeline.k_urgenci.ukolyPoTerminu.polozky.slice(0, 10) },
    }
  }

  const scope = zakazkyScopeWhere(ctx.perms, ctx.userId)
  if (scope !== null) {
    const finance = ctx.perms.financeProdejni
    const dnesStr = isoDen(now)!
    const zakazky = await nactiZakazky(ctx, scope)
    const dokoncene = (o: Obdobi) => zakazky.filter(z => z.stav === 'HOTOVO' && vObdobi(z.uzavreno, o))
    // příští týden = pondělí až neděle následujícího kalendářního týdne
    const dow = new Date(`${dnesStr}T00:00:00Z`).getUTCDay() || 7
    const pristiPo = posunDny(dnes, 8 - dow)
    const pristi = { od: isoDen(pristiPo)!, do: isoDen(posunDny(pristiPo, 6))! }
    const montaze = await montazeVRozsahu(orgPrisma(ctx.orgId), { orgId: ctx.orgId, scope, od: pristi.od, do: pristi.do })
    const ukolyWhere: Prisma.ZakazkaUkolWhereInput = {
      orgId: ctx.orgId, hotovo: false, termin: { lt: new Date(`${dnesStr}T00:00:00Z`) },
      zakazka: scope as Prisma.ZakazkaWhereInput,
    }
    const [pocetUkolu, ukoly] = await Promise.all([
      orgPrisma(ctx.orgId).zakazkaUkol.count({ where: ukolyWhere }),
      orgPrisma(ctx.orgId).zakazkaUkol.findMany({
        where: ukolyWhere,
        select: { text: true, termin: true, resitel: { select: { jmeno: true } }, zakazka: { select: { cislo: true } } },
        orderBy: { termin: 'asc' }, take: 10,
      }),
    ])
    const po = poTerminu(zakazky, dnesStr, finance)
    out.realizace = {
      dokonceneZakazky: {
        tento: dokoncene(tyden).length, minuly: dokoncene(minuly).length,
        polozky: dokoncene(tyden).map(z => {
          const v = zakazkaVystup(z, finance, dnesStr)
          return { cislo: v.cislo, klient: v.klient, technologie: v.technologie, ...(finance ? { hodnotaBezDph: v.hodnotaBezDph, vyuctovanoBezDph: v.vyuctovanoBezDph } : {}) }
        }),
      },
      montazePristiTyden: {
        ...pristi,
        pocet: montaze.length,
        polozky: montaze.map(m => ({
          od: m.od, do: m.do, cislo: m.cislo, klient: m.klient, technologie: m.technologie, etapa: m.etapa,
          technici: [m.hlavniTechnik, ...m.technici].filter(Boolean).map(t => t!.jmeno),
        })),
      },
      ukolyZakazekPoTerminu: {
        pocet: pocetUkolu,
        polozky: ukoly.map(u => ({ zakazka: u.zakazka.cislo, text: u.text.slice(0, 200), termin: isoDen(u.termin), resitel: u.resitel?.jmeno ?? null })),
      },
      zakazkyPoTerminu: { pocet: po.length, polozky: po.slice(0, 10).map(z => ({ cislo: z.cislo, klient: z.klient, stav: z.stav, montaz: z.montaz, dniPoTerminu: z.dniPoTerminu })) },
    }
  }

  if (!out.obchod && !out.realizace) return chyba('Nemáš přístup k obchodu ani k zakázkám')
  out.poznamka = 'Týden = posledních 7 dní včetně dneška, minulý = 7 dní před tím. Částky bez DPH. Úkoly po termínu: obchod = naplánované aktivity, realizace = úkoly zakázek.'
  return ok(out)
}

// ─── help_analytics ─────────────────────────────────────────────────────────

const NAPOVEDA = {
  nastroje: [
    { nastroj: 'sales_stats', kdy: 'Souhrnná čísla obchodu za období: leady, OP, win rate, objem, důvody proher. Seskupení po týdnech/měsících/obchodnících/technologiích/zdrojích, srovnání s předchozím obdobím.' },
    { nastroj: 'pipeline_snapshot', kdy: 'Co je teď rozpracované (nebo k datu v minulosti): počty a hodnoty po stavech, co visí nejdéle, nabídky bez aktivity, úkoly po termínu.' },
    { nastroj: 'list_deals', kdy: 'Konkrétní OP za období s detaily (hodnota, obchodník, zdroj, poslední aktivita, důvod prohry) — když čísla ze sales_stats potřebuješ rozepsat.' },
    { nastroj: 'deal_timeline', kdy: 'Příběh jednoho OP: změny stavů, aktivity, nabídky, poznámky — „proč jsme ho prohráli“, „co se s ním dělo“.' },
    { nastroj: 'operations_stats', kdy: 'Realizace za období: dokončené zakázky a objem, doba od výhry po montáž, vytížení techniků, zakázky po termínu.' },
    { nastroj: 'list_orders', kdy: 'Konkrétní zakázky: podle termínu montáže, stavu, technika nebo technologie, s hodnotou a vyúčtováním.' },
    { nastroj: 'weekly_report', kdy: 'Hotové týdenní shrnutí obchodu i realizace se srovnáním s minulým týdnem, bez parametrů.' },
  ],
  postupy: [
    { ucel: 'Měsíční report', kroky: ['sales_stats za měsíc s porovnat_s_predchozim=true', 'sales_stats se seskupit=obchodnik nebo zdroj, když jde o lidi či marketing', 'pipeline_snapshot k poslednímu dni měsíce', 'operations_stats za měsíc s porovnat_s_predchozim=true'] },
    { ucel: 'Srovnání více měsíců („září a říjen“)', kroky: ['sales_stats od začátku prvního do konce posledního měsíce se seskupit=mesic', 'operations_stats za každý měsíc zvlášť'] },
    { ucel: 'Týdenní porada', kroky: ['weekly_report', 'deal_timeline u největších prohraných OP, když se ptají proč'] },
    { ucel: 'Co hoří / na co zapomínáme', kroky: ['pipeline_snapshot (k_urgenci)', 'operations_stats (zakazkyPoTerminu)', 'get_briefing pro úkoly uživatele'] },
    { ucel: 'Plán montáží a vytížení', kroky: ['list_orders s od/do a podle=montaz', 'operations_stats na vytížení techniků'] },
  ],
  zasady: [
    'Částky jsou bez DPH, pokud pole neříká jinak.',
    'Datum prohry a změny stavů OP sahají do 30. 3. 2026 — u starších OP mohou chybět.',
    'Faktury a úhrady Felucia neeviduje (jsou v účetnictví) — pro realizovaný objem slouží schválená vyúčtování.',
    'Hlasem odpovídej krátce: hlavní číslo, změna proti minulému období, jedna věc k akci.',
  ],
}

// ─── Spuštění ───────────────────────────────────────────────────────────────

export async function executeProvozTool(ctx: AiKontext, name: string, input: Record<string, unknown>, now = new Date()): Promise<AiToolResult> {
  const t0 = Date.now()
  let out: AiToolResult
  switch (name) {
    case 'operations_stats': {
      const scope = zakazkyScopeWhere(ctx.perms, ctx.userId)
      out = scope === null ? chyba('Nemáš přístup k zakázkám') : await operationsStats(ctx, scope, input, now)
      break
    }
    case 'weekly_report':
      out = await weeklyReport(ctx, now)
      break
    case 'help_analytics':
      out = ok(NAPOVEDA)
      break
    default:
      out = chyba(`Neznámý nástroj: ${name}`)
  }
  console.log(`[mcp-ops] ${name} org=${ctx.orgId} user=${ctx.userId} ${Date.now() - t0}ms`)
  return out
}
