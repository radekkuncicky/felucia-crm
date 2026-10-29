import { orgPrisma } from '@/lib/orgPrisma'
import { zakazkyScopeWhere, clientScopeWhere } from '@/lib/permissions'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'
import { formatDate } from '@/lib/format'
import { ZAKAZKA_STAV_LABEL, jeZakazkaStav, zmenStavZakazky } from '@/lib/zakazkaStav'
import { quoteCelkemBezDph, radekBezDph } from '@/lib/quoteMath'
import { TECHNOLOGIE, type Technologie, isoDen, obdobi, parseDen } from './analytika'
import type { Prisma } from '@prisma/client'
import type { AiKontext, AiToolResult } from '../types'

// ─── Nástroje nad zakázkami (realizace) + poznámka k zakázce / klientovi ─────

const ZAKAZKA_STAVY = Object.keys(ZAKAZKA_STAV_LABEL)

export const ZAKAZKA_TOOLS = [
  {
    name: 'list_orders',
    description:
      'Seznam zakázek (realizací) s termínem montáže, techniky, hodnotou, vyúčtováním a otevřenými úkoly. ' +
      'Hledá podle čísla, názvu, klienta nebo adresy; filtry období (podle termínu montáže nebo založení), stavu, technika a technologie. ' +
      'Použij na „co montujeme příští týden“, „zakázky Veči v listopadu“, „rozpracované rekuperace“. Souhrnná čísla dává operations_stats.',
    input_schema: {
      type: 'object' as const,
      properties: {
        q: { type: 'string', description: 'Číslo zakázky, název, jméno klienta nebo místo; prázdné = poslední zakázky' },
        stav: {
          type: 'array', items: { type: 'string', enum: [...ZAKAZKA_STAVY] },
          description: 'Jen tyto stavy (NOVA, PRIRAZENA, V_REALIZACI, PREDANA, VYUCTOVANA, HOTOVO)',
        },
        od: { type: 'string', description: 'Začátek období YYYY-MM-DD (včetně)' },
        do: { type: 'string', description: 'Konec období YYYY-MM-DD (včetně)' },
        podle: { type: 'string', enum: ['montaz', 'zalozeni'], description: 'K čemu se vztahuje období: termín montáže (výchozí, i etapy) nebo založení zakázky' },
        technikId: { type: 'string', description: 'ID technika (z výsledků list_orders / operations_stats)' },
        technologie: { type: 'string', enum: [...TECHNOLOGIE] },
        limit: { type: 'number', description: 'Počet zakázek, výchozí 10 (s filtrem období 100), max 200' },
      },
    },
  },
  {
    name: 'get_order',
    description: 'Detail jedné zakázky: stav, klient s kontaktem, místo, termín montáže, technici, pokyny, otevřené úkoly a poslední komentáře. Použij při přípravě montáže nebo když se uživatel ptá na konkrétní zakázku.',
    input_schema: {
      type: 'object' as const,
      properties: { zakazkaId: { type: 'string', description: 'ID nebo číslo zakázky' } },
      required: ['zakazkaId'],
    },
  },
  {
    name: 'update_order_status',
    description: 'Posuň stav zakázky o jeden krok: NOVA↔PRIRAZENA↔V_REALIZACI↔PREDANA↔VYUCTOVANA↔HOTOVO. Jen manažer zakázky. Zápis — uživatel ho potvrzuje.',
    input_schema: {
      type: 'object' as const,
      properties: {
        zakazkaId: { type: 'string', description: 'ID nebo číslo zakázky' },
        stav: { type: 'string', description: 'Cílový stav' },
      },
      required: ['zakazkaId', 'stav'],
    },
  },
  {
    name: 'add_note',
    description: 'Přidej poznámku k zakázce (komentář v historii zakázky) nebo ke klientovi (poznámka na kartě klienta). Zadej právě jedno z zakazkaId / klientId.',
    input_schema: {
      type: 'object' as const,
      properties: {
        zakazkaId: { type: 'string', description: 'ID nebo číslo zakázky' },
        klientId: { type: 'string', description: 'ID klienta' },
        text: { type: 'string', description: 'Text poznámky' },
      },
      required: ['text'],
    },
  },
]

export const ZAKAZKA_TOOL_NAMES = new Set(ZAKAZKA_TOOLS.map(t => t.name))

const ok = (data: unknown): AiToolResult => ({ result: JSON.stringify(data) })
const chyba = (text: string): AiToolResult => ({ result: JSON.stringify({ chyba: text }) })

const klientJmeno = (k: { jmeno: string; prijmeni: string } | null) => (k ? `${k.jmeno} ${k.prijmeni}`.trim() : '?')


const utcDen = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)

/** Zakázka nebo některá její etapa má montáž v rozsahu dnů od–do (YYYY-MM-DD včetně; termíny jsou UTC půlnoc) */
export function montazVRozsahuWhere(od: string, doo: string): Prisma.ZakazkaWhereInput {
  const odD = new Date(`${od}T00:00:00Z`)
  const doExkl = new Date(new Date(`${doo}T00:00:00Z`).getTime() + 86_400_000)
  const v = { montazOd: { lt: doExkl }, OR: [{ montazDo: { gte: odD } }, { montazDo: null, montazOd: { gte: odD } }] }
  return { OR: [v, { etapy: { some: v } }] }
}

export const ZAKAZKA_ANALYZA_SELECT = {
  id: true, cislo: true, nazev: true, stav: true, technologie: true, vytvoreno: true, uzavreno: true,
  montazOd: true, montazDo: true, kdykoliv: true,
  klient: { select: { jmeno: true, prijmeni: true } },
  op: {
    select: {
      kod: true, vyhrano: true,
      quotes: { select: { aktivni: true, items: { select: { mnozstvi: true, cenaZaKus: true, sleva: true } } }, orderBy: { vytvoreno: 'desc' as const } },
    },
  },
  hlavniTechnik: { select: { id: true, jmeno: true } },
  techniciRel: { select: { technik: { select: { id: true, jmeno: true } } } },
  etapy: { where: { montazOd: { not: null } }, select: { montazOd: true, montazDo: true } },
  vyuctovani: { where: { stav: 'SCHVALENO' as const }, select: { polozky: { select: { mnozstvi: true, prodejniCena: true, sleva: true } } } },
  ukoly: { where: { hotovo: false }, select: { termin: true } },
} satisfies Prisma.ZakazkaSelect

export type ZakazkaAnalyza = Prisma.ZakazkaGetPayload<{ select: typeof ZAKAZKA_ANALYZA_SELECT }>

/** Hodnota zakázky = aktivní (jinak nejnovější) nabídka napojeného OP, bez DPH */
export function hodnotaZakazky(z: ZakazkaAnalyza): number | null {
  const q = z.op?.quotes.find(x => x.aktivni) ?? z.op?.quotes[0]
  return q?.items.length ? Math.round(quoteCelkemBezDph(q.items)) : null
}

/** Součet schválených vyúčtování bez DPH */
export const vyuctovanoZakazky = (z: ZakazkaAnalyza) =>
  Math.round(z.vyuctovani.reduce((s, v) => s + v.polozky.reduce((t, p) => t + radekBezDph(p), 0), 0))

/** První a poslední den montáže (YYYY-MM-DD) přes zakázku i etapy */
export function rozsahMontaze(z: ZakazkaAnalyza): { od: string; do: string } | null {
  const useky = [
    ...(z.montazOd ? [{ od: z.montazOd, do: z.montazDo ?? z.montazOd }] : []),
    ...z.etapy.map(e => ({ od: e.montazOd!, do: e.montazDo ?? e.montazOd! })),
  ]
  if (!useky.length) return null
  return {
    od: utcDen(new Date(Math.min(...useky.map(u => u.od.getTime()))))!,
    do: utcDen(new Date(Math.max(...useky.map(u => u.do.getTime()))))!,
  }
}

export function zakazkaVystup(z: ZakazkaAnalyza, finance: boolean, dnes: string) {
  const technici = new Map<string, string>()
  if (z.hlavniTechnik) technici.set(z.hlavniTechnik.id, z.hlavniTechnik.jmeno)
  for (const t of z.techniciRel) technici.set(t.technik.id, t.technik.jmeno)
  const montaz = rozsahMontaze(z)
  return {
    id: z.id, cislo: z.cislo, nazev: z.nazev, op: z.op?.kod ?? null,
    klient: klientJmeno(z.klient), technologie: z.technologie, stav: z.stav,
    montaz: montaz ? (montaz.od === montaz.do ? montaz.od : `${montaz.od} – ${montaz.do}`) : (z.kdykoliv ? 'kdykoliv' : null),
    technici: Array.from(technici, ([id, jmeno]) => ({ id, jmeno })),
    ...(finance ? { hodnotaBezDph: hodnotaZakazky(z), vyuctovanoBezDph: vyuctovanoZakazky(z) } : {}),
    otevreneUkoly: z.ukoly.length,
    ukolyPoTerminu: z.ukoly.filter(u => u.termin && utcDen(u.termin)! < dnes).length,
    zalozeno: isoDen(z.vytvoreno),
    dokonceno: isoDen(z.uzavreno),
  }
}

/** Zakázka v rozsahu uživatele podle ID nebo čísla; null = neexistuje / nemá přístup */
async function najdiZakazku(ctx: AiKontext, raw: unknown) {
  const scope = zakazkyScopeWhere(ctx.perms, ctx.userId)
  const id = String(raw ?? '').trim()
  if (scope === null || !id) return null
  return orgPrisma(ctx.orgId).zakazka.findFirst({
    where: { orgId: ctx.orgId, OR: [{ id }, { cislo: id }], ...scope },
    select: { id: true, cislo: true, nazev: true, stav: true, klient: { select: { jmeno: true, prijmeni: true } } },
  })
}

export async function popisZakazkaAkce(ctx: AiKontext, name: string, input: Record<string, unknown>) {
  if (name === 'update_order_status') {
    const z = await najdiZakazku(ctx, input.zakazkaId)
    const cil = jeZakazkaStav(input.stav) ? ZAKAZKA_STAV_LABEL[input.stav] : String(input.stav ?? '?')
    return {
      titulek: 'Změnit stav zakázky',
      radky: z
        ? [`${z.cislo} — ${z.nazev}`, `${ZAKAZKA_STAV_LABEL[z.stav]} → ${cil}`]
        : [`Zakázka ${String(input.zakazkaId ?? '?')}`, `→ ${cil}`],
    }
  }
  // add_note
  const text = String(input.text ?? '').trim()
  if (input.klientId) {
    const k = await orgPrisma(ctx.orgId).client.findFirst({
      where: { id: String(input.klientId), orgId: ctx.orgId },
      select: { jmeno: true, prijmeni: true },
    })
    return { titulek: 'Poznámka ke klientovi', radky: [klientJmeno(k), text] }
  }
  const z = await najdiZakazku(ctx, input.zakazkaId)
  return { titulek: 'Poznámka k zakázce', radky: [z ? `${z.cislo} — ${z.nazev}` : String(input.zakazkaId ?? '?'), text] }
}

export async function executeZakazkaTool(
  ctx: AiKontext,
  name: string,
  input: Record<string, unknown>,
): Promise<AiToolResult> {
  const db = orgPrisma(ctx.orgId)
  const { orgId, userId, perms } = ctx

  switch (name) {
    case 'list_orders': {
      const scope = zakazkyScopeWhere(perms, userId)
      if (scope === null) return chyba('Nemáš přístup k zakázkám')
      const q = String(input.q ?? '').trim()
      const stavy = (Array.isArray(input.stav) ? input.stav : input.stav ? [input.stav] : []).filter(jeZakazkaStav)
      const technologie = TECHNOLOGIE.includes(input.technologie as Technologie) ? (input.technologie as string) : null
      const technikId = typeof input.technikId === 'string' && input.technikId ? input.technikId : null
      const maObdobi = !!(parseDen(input.od) || parseDen(input.do))
      const o = obdobi({ od: input.od ?? '2000-01-01', do: input.do ?? '2100-12-31' })
      if (typeof o === 'string') return chyba(o)
      const podle = input.podle === 'zalozeni' ? 'zalozeni' : 'montaz'
      const limit = Math.min(200, Math.max(1, Math.floor(Number(input.limit) || (maObdobi ? 100 : 10))))

      const zakazky = await db.zakazka.findMany({
        where: {
          orgId,
          AND: [
            scope,
            stavy.length ? { stav: { in: stavy } } : {},
            technologie ? { technologie } : {},
            technikId ? {
              OR: [{ techniciRel: { some: { technikId } } }, { hlavniTechnikId: technikId }, { etapy: { some: { technici: { some: { technikId } } } } }],
            } : {},
            !maObdobi ? {}
              : podle === 'zalozeni' ? { vytvoreno: { gte: o.od, lt: o.do } }
              : montazVRozsahuWhere(isoDen(o.od)!, isoDen(new Date(o.do.getTime() - 1))!),
            q ? {
              OR: [
                { cislo: { contains: q, mode: 'insensitive' } },
                { nazev: { contains: q, mode: 'insensitive' } },
                { mistoStavby: { contains: q, mode: 'insensitive' } },
                { klient: { jmeno: { contains: q, mode: 'insensitive' } } },
                { klient: { prijmeni: { contains: q, mode: 'insensitive' } } },
              ],
            } : {},
          ],
        },
        select: ZAKAZKA_ANALYZA_SELECT,
        orderBy: maObdobi && podle === 'montaz' ? { montazOd: 'asc' } : { vytvoreno: 'desc' },
        take: limit,
      })
      if (zakazky.length === 0) return ok({ zprava: 'Žádné zakázky nenalezeny' })
      const dnes = isoDen(new Date())!
      return ok({
        pocet: zakazky.length,
        polozky: zakazky.map(z => zakazkaVystup(z, perms.financeProdejni, dnes)),
        poznamka: 'Hodnota = aktivní nabídka OP bez DPH; vyúčtováno = schválená vyúčtování bez DPH. Faktury a úhrady Felucia neeviduje (jsou v účetnictví). Problémy = otevřené úkoly zakázky.',
      })
    }

    case 'get_order': {
      const nalez = await najdiZakazku(ctx, input.zakazkaId)
      if (!nalez) return chyba('Zakázka nenalezena nebo nemáš přístup')
      const z = await db.zakazka.findFirst({
        where: { id: nalez.id, orgId },
        select: {
          id: true, cislo: true, nazev: true, stav: true, technologie: true, poznamka: true, pokyny: true,
          mistoStavby: true, montazOd: true, montazDo: true, kdykoliv: true,
          klient: { select: { id: true, jmeno: true, prijmeni: true, telefon: true, email: true } },
          op: { select: { id: true, kod: true } },
          vedouci: { select: { jmeno: true } },
          hlavniTechnik: { select: { jmeno: true } },
          techniciRel: { select: { technik: { select: { jmeno: true } } } },
          ukoly: { where: { hotovo: false }, select: { text: true, termin: true }, orderBy: { poradi: 'asc' }, take: 10 },
          komentare: {
            select: { text: true, vytvoreno: true, user: { select: { jmeno: true } } },
            orderBy: { vytvoreno: 'desc' }, take: 5,
          },
        },
      })
      if (!z) return chyba('Zakázka nenalezena')
      return {
        result: JSON.stringify({
          id: z.id, cislo: z.cislo, nazev: z.nazev, stav: z.stav, technologie: z.technologie,
          klient: { id: z.klient.id, jmeno: klientJmeno(z.klient), telefon: z.klient.telefon, email: z.klient.email },
          op: z.op?.kod ?? null,
          mistoStavby: z.mistoStavby,
          montaz: z.montazOd ? `${formatDate(z.montazOd)}${z.montazDo ? ` – ${formatDate(z.montazDo)}` : ''}` : (z.kdykoliv ? 'kdykoliv' : null),
          vedouci: z.vedouci?.jmeno ?? null,
          hlavniTechnik: z.hlavniTechnik?.jmeno ?? null,
          technici: z.techniciRel.map(t => t.technik.jmeno),
          pokyny: z.pokyny, poznamka: z.poznamka,
          otevreneUkoly: z.ukoly.map(u => ({ text: u.text, termin: u.termin ? formatDate(u.termin) : null })),
          posledniKomentare: z.komentare.map(k => ({ kdo: k.user.jmeno, kdy: formatDate(k.vytvoreno), text: k.text.slice(0, 500) })),
          odkaz: `/zakazky/${z.id}`,
        }),
      }
    }

    case 'update_order_status': {
      if (!perms.zakazkyEdit) return chyba('Nemáš oprávnění měnit stav zakázky — to dělá manažer zakázky')
      if (!jeZakazkaStav(input.stav)) return chyba('Neplatný stav zakázky')
      const z = await najdiZakazku(ctx, input.zakazkaId)
      if (!z) return chyba('Zakázka nenalezena nebo nemáš přístup')
      const r = await zmenStavZakazky(db, {
        orgId, userId, zakazkaId: z.id, stav: input.stav,
        aktor: { actorType: 'ai', aiSource: ctx.zdroj },
      })
      if (!r.ok) return chyba(r.chyba)
      return { result: JSON.stringify({ ok: true, cislo: z.cislo, stavPred: r.stavPred, novyStav: input.stav }), navigateTo: `/zakazky/${z.id}` }
    }

    case 'add_note': {
      const text = String(input.text ?? '').trim().slice(0, 5000)
      if (!text) return chyba('Text poznámky je prázdný')

      if (input.klientId && !input.zakazkaId) {
        if (!(perms.obchod || perms.zakazkyEdit)) return chyba('Nemáš oprávnění upravovat klienty')
        const scope = clientScopeWhere(perms, userId)
        if (scope === null) return chyba('Klient nenalezen nebo nemáš přístup')
        const k = await db.client.findFirst({ where: { id: String(input.klientId), orgId, ...scope }, select: { id: true, poznamka: true } })
        if (!k) return chyba('Klient nenalezen nebo nemáš přístup')
        // poznámka klienta je jedno textové pole — nový záznam se připíše na konec s datem a autorem
        const zaznam = `[${formatDate(new Date())}, ${ctx.jmeno}] ${text}`
        await db.client.update({
          where: { id: k.id },
          data: { poznamka: k.poznamka?.trim() ? `${k.poznamka.trim()}\n${zaznam}` : zaznam },
        })
        return { result: JSON.stringify({ ok: true, klientId: k.id }), navigateTo: `/clients/${k.id}` }
      }

      const z = await najdiZakazku(ctx, input.zakazkaId)
      if (!z || !(await canAccessZakazka({ id: userId, orgId }, perms, z.id))) {
        return chyba('Zakázka nenalezena nebo nemáš přístup')
      }
      await db.zakazkaKomentar.create({ data: { zakazkaId: z.id, userId, text } })
      return { result: JSON.stringify({ ok: true, zakazkaId: z.id, cislo: z.cislo }), navigateTo: `/zakazky/${z.id}` }
    }

    default:
      return chyba(`Neznámý nástroj: ${name}`)
  }
}
