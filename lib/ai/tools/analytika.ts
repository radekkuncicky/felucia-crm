import type { Prisma } from '@prisma/client'
import { orgPrisma } from '@/lib/orgPrisma'
import { quoteCelkemBezDph } from '@/lib/quoteMath'
import { prahaPulnoc } from '@/lib/kpi/obdobi'
import type { AiKontext, AiToolResult } from '../types'

// ─── Analytika obchodu pro MCP (jen čtení) ──────────────────────────────────
//
// Data se agregují v JS (stovky OP na firmu) — bez raw SQL nemusí řešit RLS
// kontext ani časová pásma. Datum uzavření prohraného OP a změny stavu bere
// z historie stavů (deal_stav_zmeny; zpětně doplněná z audit_logs od 30. 3. 2026),
// výhru z Deal.vyhrano.

const STAVY = ['NOVY', 'JEDNANI', 'NABIDKA', 'PRED_UZAVRENIM', 'USPECH', 'PAS'] as const
type Stav = (typeof STAVY)[number]
export const TECHNOLOGIE = ['KLIMA', 'TEPELNE_CERPADLO', 'REKUPERACE', 'PODLAHOVE_TOPENI', 'VZDUCHOTECHNIKA', 'JINE'] as const
export type Technologie = (typeof TECHNOLOGIE)[number]

const OBDOBI_PROPS = {
  od: { type: 'string', description: 'Začátek období YYYY-MM-DD (včetně)' },
  do: { type: 'string', description: 'Konec období YYYY-MM-DD (včetně)' },
}

export const ANALYTIKA_TOOLS = [
  {
    name: 'list_deals',
    description:
      'Výpis obchodních případů (OP) pro analýzu: datumy, hodnota nabídky, obchodník, zdroj, poslední aktivita, důvod prohry. ' +
      'Filtr období podle založení, poslední změny stavu nebo uzavření. Pro souhrnná čísla použij raději sales_stats.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ...OBDOBI_PROPS,
        podle: { type: 'string', enum: ['zalozeni', 'zmena_stavu', 'uzavreni'], description: 'K jakému datu se vztahuje období (výchozí zalozeni)' },
        stav: { type: 'array', items: { type: 'string', enum: [...STAVY] }, description: 'Jen tyto stavy' },
        technologie: { type: 'string', enum: [...TECHNOLOGIE] },
        obchodnikId: { type: 'string', description: 'ID obchodníka (z výsledků list_deals / sales_stats)' },
        zdrojPoptavkyId: { type: 'string', description: 'ID zdroje poptávky (list_zdroje_poptavky)' },
        limit: { type: 'number', description: 'Počet záznamů, výchozí 100, max 500' },
        cursor: { type: 'string', description: 'nextCursor z předchozí odpovědi' },
      },
    },
  },
  {
    name: 'sales_stats',
    description:
      'Statistiky obchodu za období: nové leady a OP, konverze lead→OP, vyhrané/prohrané, win rate, objem nabídek a vyhraných OP, ' +
      'průměrná zakázka, doba do uzavření, důvody proher. Volitelně seskupení (týden, měsíc, obchodník, technologie, zdroj) a srovnání s předchozím obdobím. ' +
      'Použij na otázky typu „jak jsme si vedli v září“.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ...OBDOBI_PROPS,
        seskupit: { type: 'string', enum: ['tyden', 'mesic', 'obchodnik', 'technologie', 'zdroj'] },
        porovnat_s_predchozim: { type: 'boolean', description: 'Přidat stejné metriky za předchozí stejně dlouhé období a rozdíl v %' },
      },
    },
  },
]

export const ANALYTIKA_TOOL_NAMES = new Set(ANALYTIKA_TOOLS.map(t => t.name))

const ok = (data: unknown): AiToolResult => ({ result: JSON.stringify(data) })
const chyba = (text: string): AiToolResult => ({ result: JSON.stringify({ chyba: text }) })

const DEN = 86_400_000
const zaokr = (n: number, des = 0) => Math.round(n * 10 ** des) / 10 ** des
const fmtIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' })
/** „YYYY-MM-DD“ v pražském čase */
export const isoDen = (d: Date | null | undefined) => (d ? fmtIso.format(d) : null)

export function parseDen(v: unknown): Date | null {
  const m = typeof v === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim()) : null
  if (!m) return null
  const d = prahaPulnoc(Number(m[1]), Number(m[2]), Number(m[3]))
  return isNaN(d.getTime()) ? null : d
}

/** Období [od, do) z inputu; do je včetně → +1 den. Výchozí: tento měsíc do dneška. */
function obdobi(input: Record<string, unknown>, now = new Date()): { od: Date; do: Date } | string {
  const dnes = isoDen(now)!
  const od = parseDen(input.od) ?? parseDen(`${dnes.slice(0, 8)}01`)!
  const doDen = parseDen(input.do) ?? parseDen(dnes)!
  const doExkl = posunDny(doDen, 1)
  if (doExkl <= od) return 'Konec období je před začátkem'
  return { od, do: doExkl }
}

/** Počet kalendářních dní období (střídání letního času neposune hranice) */
const pocetDni = (o: { od: Date; do: Date }) => Math.round((o.do.getTime() - o.od.getTime()) / DEN)
/** Pražská půlnoc o `n` dní posunutá */
export function posunDny(pulnoc: Date, n: number) {
  const [y, m, den] = isoDen(pulnoc)!.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, den + n))
  return prahaPulnoc(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

const vObdobi = (d: Date | null, o: { od: Date; do: Date }) => !!d && d >= o.od && d < o.do

/** ISO týden „YYYY-Www“ podle pražského kalendářního dne */
function tydenKlic(d: Date) {
  const [y, m, den] = isoDen(d)!.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, den))
  const dow = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dow)
  const rok = t.getUTCFullYear()
  const tyden = Math.ceil(((t.getTime() - Date.UTC(rok, 0, 1)) / DEN + 1) / 7)
  return `${rok}-W${String(tyden).padStart(2, '0')}`
}

const POLOZKY = { select: { mnozstvi: true, cenaZaKus: true, sleva: true } } as const

const klientJmeno = (k: { jmeno: string; prijmeni: string } | null) => (k ? `${k.jmeno} ${k.prijmeni}`.trim() : null)

// ─── Načtení OP s odvozenými daty ───────────────────────────────────────────

export interface OpAnalyza {
  id: string
  kod: string | null
  predmet: string | null
  technologie: string
  stav: string
  klient: string | null
  mesto: string | null
  obchodnikId: string | null
  obchodnik: string | null
  zdrojId: string | null
  zdroj: string | null
  zalozeno: Date
  zmenaStavu: Date | null
  uzavreno: Date | null
  hodnotaBezDph: number | null
  hodnotaSDph: number | null
  pocetNabidek: number
  posledniAktivita: Date | null
  /** Historie stavů vzestupně; první záznam = stav při založení */
  historie: { stav: string; kdy: Date }[]
  duvodProhryKod: string | null
  duvodProhry: string | null
  /** Kdy OP dostal první nabídku: odeslání, jinak vytvoření (odeslání se zatím skoro neeviduje) */
  nabidnuto: Date | null
}

/** Rozsah obchodníka: bez práva na cizí OP jen vlastní */
export function scopeOp(ctx: AiKontext): Prisma.DealWhereInput {
  return ctx.perms.obchodCiziOP ? {} : { userId: ctx.userId }
}

export async function nactiOp(ctx: AiKontext, where: Prisma.DealWhereInput = {}, now = new Date()): Promise<OpAnalyza[]> {
  const db = orgPrisma(ctx.orgId)
  const deals = await db.deal.findMany({
    where: { orgId: ctx.orgId, stav: { not: 'ZNEPLATNENO' }, AND: [scopeOp(ctx), where] },
    select: {
      id: true, kod: true, predmet: true, technologie: true, stav: true, vytvoreno: true, vyhrano: true,
      duvodProhry: true, duvodProhryKod: true, dphSazba: true, userId: true, zdrojPoptavkyId: true,
      client: { select: { jmeno: true, prijmeni: true, mesto: true } },
      user: { select: { jmeno: true } },
      zdrojPoptavky: { select: { nazev: true } },
      quotes: {
        select: { aktivni: true, dphSazba: true, odeslanoAt: true, vytvoreno: true, items: POLOZKY },
        orderBy: { vytvoreno: 'desc' },
      },
      quoteItems: { where: { quoteId: null }, ...POLOZKY },
      activities: {
        // kontakt = dokončená aktivita nebo poznámka; naplánovaná po termínu se nestala
        where: { datum: { lte: now }, OR: [{ stav: 'DOKONCENA' }, { typ: 'POZNAMKA', stav: { not: 'ZRUSENA' } }] },
        select: { datum: true }, orderBy: { datum: 'desc' }, take: 1,
      },
      stavZmeny: { where: { vytvoreno: { lte: now } }, select: { naStav: true, zStavu: true, vytvoreno: true }, orderBy: { vytvoreno: 'asc' } },
    },
  })
  if (deals.length === 0) return []

  return deals.map(d => {
    const historie = d.stavZmeny.map(z => ({ stav: z.naStav as string, kdy: z.vytvoreno }))
    const zmeny = d.stavZmeny.filter(z => z.zStavu !== null)
    const posledniDoStavu = [...historie].reverse().find(z => z.stav === d.stav)?.kdy ?? null
    const uzavreno = d.stav === 'USPECH' ? (d.vyhrano ?? posledniDoStavu) : d.stav === 'PAS' ? posledniDoStavu : null
    // hodnota OP = aktivní nabídka, jinak nejnovější, jinak staré položky bez nabídky (jako seznam OP)
    const nabidka = d.quotes.find(q => q.aktivni) ?? d.quotes[0]
    const items = nabidka?.items ?? d.quoteItems
    const bez = items.length ? quoteCelkemBezDph(items) : null
    const sazba = nabidka?.dphSazba ?? d.dphSazba
    return {
      id: d.id, kod: d.kod, predmet: d.predmet, technologie: d.technologie, stav: d.stav,
      klient: klientJmeno(d.client), mesto: d.client?.mesto ?? null,
      obchodnikId: d.userId, obchodnik: d.user?.jmeno ?? null,
      zdrojId: d.zdrojPoptavkyId, zdroj: d.zdrojPoptavky?.nazev ?? null,
      zalozeno: d.vytvoreno,
      zmenaStavu: zmeny.length ? zmeny[zmeny.length - 1].vytvoreno : null,
      uzavreno,
      hodnotaBezDph: bez === null ? null : zaokr(bez, 2),
      hodnotaSDph: bez === null ? null : zaokr(bez * (1 + sazba / 100), 2),
      pocetNabidek: d.quotes.length,
      posledniAktivita: d.activities[0]?.datum ?? null,
      historie,
      duvodProhryKod: d.duvodProhryKod, duvodProhry: d.duvodProhry,
      nabidnuto: d.quotes.reduce<Date | null>((min, q) => {
        const t = q.odeslanoAt ?? q.vytvoreno
        return !min || t < min ? t : min
      }, null),
    }
  })
}

export const dnyMezi = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / DEN)

function opVystup(o: OpAnalyza, now: Date) {
  return {
    id: o.id, kod: o.kod, predmet: o.predmet, technologie: o.technologie, stav: o.stav,
    klient: o.klient, mesto: o.mesto,
    obchodnik: o.obchodnik, obchodnikId: o.obchodnikId,
    zdrojPoptavky: o.zdroj,
    zalozeno: isoDen(o.zalozeno), zmenaStavu: isoDen(o.zmenaStavu), uzavreno: isoDen(o.uzavreno),
    hodnotaBezDph: o.hodnotaBezDph, hodnotaSDph: o.hodnotaSDph, pocetNabidek: o.pocetNabidek,
    posledniAktivita: isoDen(o.posledniAktivita),
    dnyBezAktivity: dnyMezi(o.posledniAktivita ?? o.zalozeno, now),
    duvodProhry: o.stav === 'PAS' ? { kod: o.duvodProhryKod, text: o.duvodProhry } : null,
  }
}

const POZNAMKA_HISTORIE = 'Datum uzavření prohraných OP a změny stavu jsou z historie stavů, která sahá do 30. 3. 2026 — u starších změn může chybět (null).'

// ─── sales_stats ────────────────────────────────────────────────────────────

interface Leady { vytvoreno: Date; prevedeno: boolean; obchodnikId: string | null; obchodnik: string | null; zdrojId: string | null; zdroj: string | null }

interface Udalosti {
  leady: Leady[]
  noveOp: OpAnalyza[]
  uzavrene: OpAnalyza[]
  nabidnute: OpAnalyza[]
}

function metriky(u: Udalosti) {
  const vyhrane = u.uzavrene.filter(o => o.stav === 'USPECH')
  const prohrane = u.uzavrene.filter(o => o.stav === 'PAS')
  const objemVyhranych = vyhrane.reduce((s, o) => s + (o.hodnotaBezDph ?? 0), 0)
  const prevedene = u.leady.filter(l => l.prevedeno).length
  const dny = (arr: OpAnalyza[]) => (arr.length ? zaokr(arr.reduce((s, o) => s + dnyMezi(o.zalozeno, o.uzavreno!), 0) / arr.length, 1) : null)
  const duvody: Record<string, number> = {}
  for (const o of prohrane) duvody[o.duvodProhryKod ?? 'NEUVEDENO'] = (duvody[o.duvodProhryKod ?? 'NEUVEDENO'] ?? 0) + 1
  return {
    noveLeady: u.leady.length,
    noveOp: u.noveOp.length,
    konverzeLeadNaOpProc: u.leady.length ? zaokr((prevedene / u.leady.length) * 100, 1) : null,
    vyhrane: vyhrane.length,
    prohrane: prohrane.length,
    winRateProc: u.uzavrene.length ? zaokr((vyhrane.length / u.uzavrene.length) * 100, 1) : null,
    nabidnuteOp: u.nabidnute.length,
    objemNabidekBezDph: zaokr(u.nabidnute.reduce((s, o) => s + (o.hodnotaBezDph ?? 0), 0)),
    objemVyhranychBezDph: zaokr(objemVyhranych),
    prumernaVyhranaBezDph: vyhrane.length ? zaokr(objemVyhranych / vyhrane.length) : null,
    prumerDnuDoUzavreni: dny(u.uzavrene),
    prumerDnuDoVyhry: dny(vyhrane),
    duvodyProher: duvody,
  }
}

type Metriky = ReturnType<typeof metriky>

function rozdilProc(a: Metriky, b: Metriky) {
  const out: Record<string, number | null> = {}
  for (const k of Object.keys(a) as (keyof Metriky)[]) {
    const x = a[k], y = b[k]
    if (typeof x !== 'number' || typeof y !== 'number') continue
    out[k] = y === 0 ? null : zaokr(((x - y) / Math.abs(y)) * 100, 1)
  }
  return out
}

async function nactiUdalosti(ctx: AiKontext, o: { od: Date; do: Date }, opy: OpAnalyza[]): Promise<Udalosti> {
  const leady = await orgPrisma(ctx.orgId).lead.findMany({
    where: {
      orgId: ctx.orgId, vytvoreno: { gte: o.od, lt: o.do },
      ...(ctx.perms.obchodCiziOP ? {} : { assignedToId: ctx.userId }),
    },
    select: {
      vytvoreno: true, prevedenNaOpId: true, assignedToId: true, zdrojPoptavkyId: true,
      assignedTo: { select: { jmeno: true } }, zdrojPoptavky: { select: { nazev: true } },
    },
  })
  return {
    leady: leady.map(l => ({
      vytvoreno: l.vytvoreno, prevedeno: !!l.prevedenNaOpId,
      obchodnikId: l.assignedToId, obchodnik: l.assignedTo?.jmeno ?? null,
      zdrojId: l.zdrojPoptavkyId, zdroj: l.zdrojPoptavky?.nazev ?? null,
    })),
    noveOp: opy.filter(op => vObdobi(op.zalozeno, o)),
    uzavrene: opy.filter(op => (op.stav === 'USPECH' || op.stav === 'PAS') && vObdobi(op.uzavreno, o)),
    nabidnute: opy.filter(op => vObdobi(op.nabidnuto, o)),
  }
}

type Seskupeni = 'tyden' | 'mesic' | 'obchodnik' | 'technologie' | 'zdroj'

function seskup(u: Udalosti, podle: Seskupeni) {
  const skupiny = new Map<string, { nazev: string; u: Udalosti }>()
  const pridej = <K extends keyof Udalosti>(typ: K, klic: string, nazev: string, x: Udalosti[K][number]) => {
    if (!skupiny.has(klic)) skupiny.set(klic, { nazev, u: { leady: [], noveOp: [], uzavrene: [], nabidnute: [] } })
    ;(skupiny.get(klic)!.u[typ] as Udalosti[K][number][]).push(x)
  }
  const cas = (d: Date) => (podle === 'tyden' ? tydenKlic(d) : isoDen(d)!.slice(0, 7))
  const opKlic = (op: OpAnalyza, d: Date): [string, string] => {
    switch (podle) {
      case 'obchodnik': return [op.obchodnikId ?? '-', op.obchodnik ?? 'Bez obchodníka']
      case 'technologie': return [op.technologie, op.technologie]
      case 'zdroj': return [op.zdrojId ?? '-', op.zdroj ?? 'Neuvedeno']
      default: return [cas(d), cas(d)]
    }
  }
  for (const l of u.leady) {
    const [k, n] = podle === 'obchodnik' ? [l.obchodnikId ?? '-', l.obchodnik ?? 'Bez obchodníka']
      : podle === 'zdroj' ? [l.zdrojId ?? '-', l.zdroj ?? 'Neuvedeno']
      : podle === 'technologie' ? ['-', 'Lead (bez technologie)']
      : [cas(l.vytvoreno), cas(l.vytvoreno)]
    pridej('leady', k, n, l)
  }
  for (const op of u.noveOp) pridej('noveOp', ...opKlic(op, op.zalozeno), op)
  for (const op of u.uzavrene) pridej('uzavrene', ...opKlic(op, op.uzavreno!), op)
  for (const op of u.nabidnute) pridej('nabidnute', ...opKlic(op, op.nabidnuto!), op)
  return Array.from(skupiny.entries())
    .map(([klic, s]) => ({ klic, nazev: s.nazev, ...metriky(s.u) }))
    .sort((a, b) => (podle === 'tyden' || podle === 'mesic' ? a.klic.localeCompare(b.klic) : b.objemVyhranychBezDph - a.objemVyhranychBezDph))
}

// ─── Spuštění ───────────────────────────────────────────────────────────────

export async function executeAnalytikaTool(ctx: AiKontext, name: string, input: Record<string, unknown>, now = new Date()): Promise<AiToolResult> {
  if (!ctx.perms.obchod) return chyba('Nemáš přístup k obchodu')
  const t0 = Date.now()
  const log = (info: string) => console.log(`[mcp-analytics] ${name} org=${ctx.orgId} user=${ctx.userId} ${info} ${Date.now() - t0}ms`)

  switch (name) {
    case 'list_deals': {
      const where: Prisma.DealWhereInput = {}
      const stavy = (Array.isArray(input.stav) ? input.stav : input.stav ? [input.stav] : []).filter((s): s is Stav => STAVY.includes(s as Stav))
      if (stavy.length) where.stav = { in: stavy }
      if (TECHNOLOGIE.includes(input.technologie as Technologie)) where.technologie = input.technologie as Technologie
      if (typeof input.obchodnikId === 'string' && input.obchodnikId) where.userId = input.obchodnikId
      if (typeof input.zdrojPoptavkyId === 'string' && input.zdrojPoptavkyId) where.zdrojPoptavkyId = input.zdrojPoptavkyId

      const podle = input.podle === 'zmena_stavu' || input.podle === 'uzavreni' ? input.podle : 'zalozeni'
      const maObdobi = !!(parseDen(input.od) || parseDen(input.do))
      const o = obdobi({ od: input.od ?? '2000-01-01', do: input.do }, now)
      if (typeof o === 'string') return chyba(o)
      // při filtru podle založení zúžit už v DB
      if (maObdobi && podle === 'zalozeni') where.vytvoreno = { gte: o.od, lt: o.do }

      const datum = (op: OpAnalyza) => (podle === 'zmena_stavu' ? op.zmenaStavu : podle === 'uzavreni' ? op.uzavreno : op.zalozeno)
      const opy = (await nactiOp(ctx, where, now))
        .filter(op => !maObdobi || vObdobi(datum(op), o))
        .sort((a, b) => (datum(b)?.getTime() ?? 0) - (datum(a)?.getTime() ?? 0))

      const limit = Math.min(500, Math.max(1, Math.floor(Number(input.limit) || 100)))
      const offset = Math.max(0, Math.floor(Number(input.cursor) || 0))
      const stranka = opy.slice(offset, offset + limit)
      log(`celkem=${opy.length} vraceno=${stranka.length}`)
      return ok({
        celkem: opy.length,
        nextCursor: offset + limit < opy.length ? String(offset + limit) : null,
        podle,
        ...(maObdobi ? { obdobi: { od: isoDen(o.od), do: isoDen(new Date(o.do.getTime() - 1)) } } : {}),
        polozky: stranka.map(op => opVystup(op, now)),
        poznamka: `Hodnota = aktivní nabídka (jinak nejnovější). ${POZNAMKA_HISTORIE}`,
      })
    }

    case 'sales_stats': {
      const o = obdobi(input, now)
      if (typeof o === 'string') return chyba(o)
      const pred = { od: posunDny(o.od, -pocetDni(o)), do: o.od }
      const porovnat = input.porovnat_s_predchozim === true
      // OP se načtou jednou (všechny v rozsahu uživatele), období se filtruje v JS
      const opy = await nactiOp(ctx, {}, now)
      const u = await nactiUdalosti(ctx, o, opy)
      const celkem = metriky(u)
      const out: Record<string, unknown> = {
        obdobi: { od: isoDen(o.od), do: isoDen(new Date(o.do.getTime() - 1)) },
        celkem,
      }
      const podle = ['tyden', 'mesic', 'obchodnik', 'technologie', 'zdroj'].includes(String(input.seskupit)) ? (input.seskupit as Seskupeni) : null
      if (podle) out.skupiny = seskup(u, podle)
      if (porovnat) {
        const p = metriky(await nactiUdalosti(ctx, pred, opy))
        out.predchozi = { obdobi: { od: isoDen(pred.od), do: isoDen(new Date(pred.do.getTime() - 1)) }, celkem: p }
        out.rozdilProc = rozdilProc(celkem, p)
      }
      const bezData = opy.filter(op => op.stav === 'PAS' && !op.uzavreno).length
      out.poznamka = [
        'Vyhrané/prohrané a win rate podle data uzavření v období; objem vyhraných = hodnota aktivní nabídky vyhraných OP; objem nabídek = OP, které v období dostaly první nabídku (datum odeslání, jinak vytvoření — odeslání se zatím neeviduje), hodnota aktivní nabídky jednou za OP; konverze = leady z období převedené na OP. Částky bez DPH.',
        bezData ? `${bezData} prohraných OP nemá datum uzavření (starší než historie změn) a v obdobích se nepočítají.` : '',
        ctx.perms.obchodCiziOP ? '' : 'Jen tvoje OP a leady.',
      ].filter(Boolean).join(' ')
      log(`od=${isoDen(o.od)} skupiny=${podle ?? '-'} op=${opy.length}`)
      return ok(out)
    }

    default:
      return chyba(`Neznámý nástroj: ${name}`)
  }
}
