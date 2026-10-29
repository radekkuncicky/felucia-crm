import { orgPrisma } from '@/lib/orgPrisma'
import { clientScopeWhere } from '@/lib/permissions'
import { slozAdresu } from '@/lib/klientAdresa'
import type { AiKontext, AiToolResult } from '../types'

// ─── Úprava klienta (dvoukrokově: náhled „původní → nové“, pak zápis) ───────

export const KLIENT_TOOLS = [
  {
    name: 'update_client',
    description:
      'Uprav údaje klienta: jméno, příjmení, e-mail, telefon, adresu. Uveď jen měněná pole; u adresy jen měněné části. ' +
      'V Claude jde o dva kroky: první volání vrátí náhled původních a nových hodnot — ukaž ho uživateli a po jeho souhlasu zavolej znovu se stejnými údaji a potvrdit=true.',
    input_schema: {
      type: 'object' as const,
      properties: {
        klientId: { type: 'string', description: 'ID klienta (search_clients)' },
        jmeno: { type: 'string', description: 'U firmy název firmy' },
        prijmeni: { type: 'string' },
        email: { type: 'string', description: 'Prázdný řetězec údaj smaže' },
        telefon: { type: 'string', description: 'Prázdný řetězec údaj smaže' },
        adresa: {
          type: 'object',
          properties: {
            ulice: { type: 'string', description: 'Název ulice (bez čísla)' },
            cislo: { type: 'string', description: 'Číslo popisné/orientační' },
            obec: { type: 'string' },
            castObce: { type: 'string', description: 'Část obce — místo ulice u obcí bez ulic' },
            psc: { type: 'string' },
          },
        },
        potvrdit: { type: 'boolean', description: 'true až po souhlasu uživatele s náhledem' },
      },
      required: ['klientId'],
    },
  },
]

export const KLIENT_TOOL_NAMES = new Set(KLIENT_TOOLS.map(t => t.name))

const chyba = (text: string): AiToolResult => ({ result: JSON.stringify({ chyba: text }) })

const POPISKY: Record<string, string> = {
  jmeno: 'Jméno', prijmeni: 'Příjmení', email: 'E-mail', telefon: 'Telefon', ulice: 'Ulice', mesto: 'Obec', psc: 'PSČ',
}

type Pole = keyof typeof POPISKY

/** Klient v rozsahu uživatele + změněná pole; chyba = text */
async function pripravZmenu(ctx: AiKontext, input: Record<string, unknown>) {
  if (!(ctx.perms.obchod || ctx.perms.zakazkyEdit)) return 'Nemáš oprávnění upravovat klienty'
  const scope = clientScopeWhere(ctx.perms, ctx.userId)
  if (scope === null) return 'Klient nenalezen nebo nemáš přístup'
  const k = await orgPrisma(ctx.orgId).client.findFirst({
    where: { id: String(input.klientId ?? ''), orgId: ctx.orgId, anonymizedAt: null, ...scope },
    select: { id: true, typKlienta: true, jmeno: true, prijmeni: true, email: true, telefon: true, ulice: true, mesto: true, psc: true },
  })
  if (!k) return 'Klient nenalezen nebo nemáš přístup'

  const nove: Partial<Record<Pole, string | null>> = {}
  for (const pole of ['jmeno', 'prijmeni', 'email', 'telefon'] as const) {
    if (input[pole] === undefined || input[pole] === null) continue
    const v = String(input[pole]).trim()
    if (pole === 'jmeno' && !v) return 'Jméno nesmí být prázdné'
    if (pole === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Neplatný e-mail'
    nove[pole] = pole === 'jmeno' || pole === 'prijmeni' ? v : v || null
  }
  if (input.adresa && typeof input.adresa === 'object') {
    const adresa = slozAdresu(input.adresa as Record<string, unknown>)
    if (typeof adresa === 'string') return adresa
    Object.assign(nove, adresa)
  }
  const zmeny = (Object.keys(nove) as Pole[])
    .filter(p => (k[p as keyof typeof k] ?? null) !== (nove[p] ?? null))
    .map(p => ({ pole: p, popisek: POPISKY[p], puvodni: (k[p as keyof typeof k] as string | null) ?? null, nove: nove[p] ?? null }))
  if (!zmeny.length) return 'Žádná změna — údaje jsou stejné jako v CRM'
  return { k, zmeny }
}

const nazevKlienta = (k: { typKlienta: string; jmeno: string; prijmeni: string }) =>
  k.typKlienta === 'FIRMA' ? k.jmeno : `${k.jmeno} ${k.prijmeni}`.trim()

const radek = (z: { popisek: string; puvodni: string | null; nove: string | null }) => `${z.popisek}: ${z.puvodni ?? '—'} → ${z.nove ?? '—'}`

/** Řádky potvrzovací karty — původní a nové hodnoty */
export async function popisKlientAkce(ctx: AiKontext, input: Record<string, unknown>) {
  const p = await pripravZmenu(ctx, input)
  if (typeof p === 'string') return { titulek: 'Upravit klienta', radky: [p] }
  return { titulek: 'Upravit klienta', radky: [nazevKlienta(p.k), ...p.zmeny.map(radek)] }
}

export async function executeKlientTool(ctx: AiKontext, name: string, input: Record<string, unknown>): Promise<AiToolResult> {
  if (name !== 'update_client') return chyba(`Neznámý nástroj: ${name}`)
  const p = await pripravZmenu(ctx, input)
  if (typeof p === 'string') return chyba(p)

  // web potvrzuje kartou před spuštěním; MCP potvrzuje druhým voláním
  if (ctx.zdroj === 'mcp' && input.potvrdit !== true) {
    return {
      result: JSON.stringify({
        nahled: true, klient: nazevKlienta(p.k), zmeny: p.zmeny.map(({ popisek, puvodni, nove }) => ({ pole: popisek, puvodni, nove })),
        napoveda: 'Nic se zatím nezměnilo. Ukaž uživateli změny a po jeho souhlasu zavolej update_client znovu se stejnými údaji a potvrdit=true.',
      }),
    }
  }

  await orgPrisma(ctx.orgId).client.update({
    where: { id: p.k.id },
    data: Object.fromEntries(p.zmeny.map(z => [z.pole, z.nove])),
  })
  return {
    result: JSON.stringify({
      ok: true, klientId: p.k.id, nazev: nazevKlienta({ ...p.k, ...Object.fromEntries(p.zmeny.map(z => [z.pole, z.nove ?? ''])) }),
      zmeny: Object.fromEntries(p.zmeny.map(z => [z.pole, { z: z.puvodni, na: z.nove }])),
    }),
    navigateTo: `/clients/${p.k.id}`,
  }
}
