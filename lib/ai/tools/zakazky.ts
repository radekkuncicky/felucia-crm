import { orgPrisma } from '@/lib/orgPrisma'
import { zakazkyScopeWhere, clientScopeWhere } from '@/lib/permissions'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'
import { formatDate } from '@/lib/format'
import { ZAKAZKA_STAV_LABEL, jeZakazkaStav, zmenStavZakazky } from '@/lib/zakazkaStav'
import type { AiKontext, AiToolResult } from '../types'

// ─── Nástroje nad zakázkami (realizace) + poznámka k zakázce / klientovi ─────

export const ZAKAZKA_TOOLS = [
  {
    name: 'list_orders',
    description: 'Seznam zakázek (realizací). Hledá podle čísla, názvu, klienta nebo adresy; volitelně filtr stavu.',
    input_schema: {
      type: 'object' as const,
      properties: {
        q: { type: 'string', description: 'Číslo zakázky, název, jméno klienta nebo místo; prázdné = poslední zakázky' },
        stav: { type: 'string', description: 'NOVA | PRIRAZENA | V_REALIZACI | PREDANA | VYUCTOVANA | HOTOVO' },
      },
    },
  },
  {
    name: 'get_order',
    description: 'Detail zakázky: stav, klient, místo, termín montáže, technici, pokyny, otevřené úkoly a poslední komentáře.',
    input_schema: {
      type: 'object' as const,
      properties: { zakazkaId: { type: 'string', description: 'ID nebo číslo zakázky' } },
      required: ['zakazkaId'],
    },
  },
  {
    name: 'update_order_status',
    description: 'Změň stav zakázky. Povolené kroky: NOVA↔PRIRAZENA↔V_REALIZACI↔PREDANA↔VYUCTOVANA↔HOTOVO (vždy o jeden).',
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
      const zakazky = await db.zakazka.findMany({
        where: {
          orgId,
          AND: [
            scope,
            jeZakazkaStav(input.stav) ? { stav: input.stav } : {},
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
        select: {
          id: true, cislo: true, nazev: true, stav: true, technologie: true, montazOd: true, montazDo: true,
          klient: { select: { jmeno: true, prijmeni: true } },
        },
        orderBy: { vytvoreno: 'desc' },
        take: 10,
      })
      if (zakazky.length === 0) return ok({ zprava: 'Žádné zakázky nenalezeny' })
      return ok(zakazky.map(z => ({
        id: z.id, cislo: z.cislo, nazev: z.nazev, stav: z.stav, technologie: z.technologie,
        klient: klientJmeno(z.klient),
        montaz: z.montazOd ? `${formatDate(z.montazOd)}${z.montazDo ? ` – ${formatDate(z.montazDo)}` : ''}` : null,
      })))
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
