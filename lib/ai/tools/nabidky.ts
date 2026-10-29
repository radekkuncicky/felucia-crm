import type { Prisma } from '@prisma/client'
import { orgPrisma } from '@/lib/orgPrisma'
import { quoteCelkemBezDph, quoteCelkemSDph } from '@/lib/quoteMath'
import { loadProductSnapshots, resolveNakupniCena } from '@/lib/quoteItems'
import { zkopirujNabidku } from '@/lib/quoteCopy'
import { SOD_ZAMYKA, duvodNelzeSmazat, duvodZamkuNabidky } from '@/lib/quoteZamek'
import { scopeOp } from './analytika'
import type { AiKontext, AiToolResult } from '../types'

// ─── Práce s existujícími nabídkami (CN) a přesun OP na jiného klienta ──────
//
// Tenant jen z kontextu. Položky (QuoteItem nemá orgId) se vždy hledají přes
// nadřazenou nabídku firmy; cizí ID = „nenalezeno“. Součty počítá
// lib/quoteMath — stejný vzorec jako editor nabídky v UI.

const POLOZKA_PROPS = {
  nazev: { type: 'string' },
  mnozstvi: { type: 'number' },
  cenaZaKus: { type: 'number', description: 'Prodejní cena za jednotku bez DPH' },
  jednotka: { type: 'string', description: 'Výchozí: jednotka produktu, jinak ks' },
  sleva: { type: 'number', description: 'Sleva na položku v %' },
}

export const NABIDKA_TOOLS = [
  {
    name: 'get_quote',
    description:
      'Detail jedné cenové nabídky (CN): hlavička (OP, klient, stav, aktivní, DPH, součty bez a s DPH) a všechny položky s ID, pořadím, cenou, slevou a součtem. ' +
      'Použij před update_quote (potřebuješ ID položek) nebo když se uživatel ptá, co v nabídce je.',
    input_schema: {
      type: 'object' as const,
      properties: { quoteId: { type: 'string', description: 'ID nebo kód nabídky (např. NAB-26-0288)' } },
      required: ['quoteId'],
    },
  },
  {
    name: 'update_quote',
    description:
      'Uprav existující nabídku: název a položky (změnit, přidat, odebrat) najednou — buď projde všechno, nebo nic. ID položek získáš z get_quote. ' +
      'Akceptovanou nabídku ani aktivní nabídku OP se smlouvou u podpisu nebo se zakázkou upravit nejde — pak navrhni copy_quote. Zápis — uživatel ho potvrzuje.',
    input_schema: {
      type: 'object' as const,
      properties: {
        quoteId: { type: 'string', description: 'ID nebo kód nabídky' },
        nazev: { type: 'string', description: 'Nový název nabídky' },
        update: {
          type: 'array', description: 'Změny existujících položek — uveď jen měněná pole',
          items: { type: 'object', properties: { itemId: { type: 'string' }, ...POLOZKA_PROPS }, required: ['itemId'] },
        },
        add: {
          type: 'array', description: 'Nové položky (přidají se na konec)',
          items: {
            type: 'object',
            properties: { ...POLOZKA_PROPS, productId: { type: 'string', description: 'ID z katalogu (search_products) — nepovinné' } },
            required: ['nazev', 'mnozstvi', 'cenaZaKus'],
          },
        },
        remove: { type: 'array', items: { type: 'string' }, description: 'ID položek k odebrání' },
      },
      required: ['quoteId'],
    },
  },
  {
    name: 'copy_quote',
    description:
      'Zkopíruj nabídku i se slevami, DPH a pořadím položek do jiného OP — i OP jiného klienta (např. když zakázku přebírá firma). ' +
      'Kopie je neaktivní a dostane nové číslo; vrátí její součet i součet originálu pro kontrolu. Zápis — uživatel ho potvrzuje.',
    input_schema: {
      type: 'object' as const,
      properties: {
        quoteId: { type: 'string', description: 'ID nebo kód kopírované nabídky' },
        targetDealId: { type: 'string', description: 'ID nebo kód cílového OP (např. OP-26-196)' },
        nazev: { type: 'string', description: 'Název kopie, výchozí „Kopie - <název>“' },
      },
      required: ['quoteId', 'targetDealId'],
    },
  },
  {
    name: 'delete_quote',
    description: 'Smaž nabídku. Jde jen u neaktivní rozpracované nabídky, která nebyla odeslaná ani sdílená klientovi. Zápis — uživatel ho potvrzuje.',
    input_schema: {
      type: 'object' as const,
      properties: { quoteId: { type: 'string', description: 'ID nebo kód nabídky' } },
      required: ['quoteId'],
    },
  },
  {
    name: 'change_deal_client',
    description:
      'Přesuň OP na jiného klienta stejné firmy; jeho zakázky jdou s ním a ve smlouvě (SOD) v návrhu se přepíšou údaje klienta. ' +
      'Odmítne, když má OP vyúčtovanou nebo hotovou zakázku nebo smlouvu u podpisu či podepsanou — force=true jen na výslovné přání uživatele. Zápis — uživatel ho potvrzuje.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dealId: { type: 'string', description: 'ID nebo kód OP' },
        clientId: { type: 'string', description: 'ID nového klienta (search_clients)' },
        force: { type: 'boolean', description: 'Přesunout i přes vyúčtovanou zakázku / smlouvu u podpisu — jen když to uživatel výslovně chce' },
      },
      required: ['dealId', 'clientId'],
    },
  },
]

export const NABIDKA_TOOL_NAMES = new Set(NABIDKA_TOOLS.map(t => t.name))

const ok = (data: unknown): AiToolResult => ({ result: JSON.stringify(data) })
const chyba = (text: string): AiToolResult => ({ result: JSON.stringify({ chyba: text }) })

const kc = (n: number) => Math.round(n * 100) / 100
const klientJmeno = (k: { jmeno: string; prijmeni: string } | null | undefined) => (k ? `${k.jmeno} ${k.prijmeni}`.trim() : null)

const NABIDKA_INCLUDE = {
  items: { orderBy: { poradi: 'asc' as const } },
  deal: { select: { id: true, kod: true, client: { select: { jmeno: true, prijmeni: true } } } },
} satisfies Prisma.QuoteInclude

/** Nabídka firmy v rozsahu uživatele podle ID nebo kódu; null = neexistuje / nemá přístup */
async function najdiNabidku(ctx: AiKontext, raw: unknown) {
  const id = String(raw ?? '').trim()
  if (!id) return null
  return orgPrisma(ctx.orgId).quote.findFirst({
    where: { orgId: ctx.orgId, OR: [{ id }, { kod: id }], deal: { orgId: ctx.orgId, ...scopeOp(ctx) } },
    include: NABIDKA_INCLUDE,
  })
}

async function najdiOp(ctx: AiKontext, raw: unknown) {
  const id = String(raw ?? '').trim()
  if (!id) return null
  return orgPrisma(ctx.orgId).deal.findFirst({
    where: { orgId: ctx.orgId, OR: [{ id }, { kod: id }], stav: { not: 'ZNEPLATNENO' }, ...scopeOp(ctx) },
    select: { id: true, kod: true, predmet: true, clientId: true, client: { select: { jmeno: true, prijmeni: true } } },
  })
}

type Nabidka = NonNullable<Awaited<ReturnType<typeof najdiNabidku>>>

function polozkaVystup(i: Nabidka['items'][number]) {
  return {
    id: i.id, poradi: i.poradi, nazev: i.nazev, kod: i.kod, productId: i.productId,
    mnozstvi: Number(i.mnozstvi), jednotka: i.jednotka, cenaZaKus: Number(i.cenaZaKus), sleva: Number(i.sleva),
    celkemBezDph: kc(quoteCelkemBezDph([i])), poznamky: i.poznamky,
  }
}

function nabidkaVystup(q: Nabidka) {
  return {
    id: q.id, kod: q.kod, nazev: q.nazev, popis: q.popis,
    dealId: q.deal.id, op: q.deal.kod, klient: klientJmeno(q.deal.client),
    aktivni: q.aktivni, stav: q.stav, odeslano: q.odeslanoAt?.toISOString().slice(0, 10) ?? null,
    dphSazba: q.dphSazba,
    celkemBezDph: kc(quoteCelkemBezDph(q.items)), celkemSDph: kc(quoteCelkemSDph(q.items, q.dphSazba)),
    pocetPolozek: q.items.length,
    polozky: q.items.map(polozkaVystup),
    odkaz: `/deals/${q.deal.id}`,
  }
}

// ─── update_quote ───────────────────────────────────────────────────────────

type ZmenaPolozky = { itemId: string; data: Prisma.QuoteItemUpdateManyMutationInput }
type NovaPolozka = { nazev: string; mnozstvi: number; cenaZaKus: number; jednotka?: string; sleva: number; productId?: string }

const cislo = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : Number(v))

/** Pole položky ze vstupu; chyba = text */
function polePolozky(x: Record<string, unknown>): Prisma.QuoteItemUpdateManyMutationInput | string {
  const data: Prisma.QuoteItemUpdateManyMutationInput = {}
  if (x.nazev !== undefined) {
    const n = String(x.nazev).trim()
    if (!n) return 'Název položky nesmí být prázdný'
    data.nazev = n
  }
  const mnozstvi = cislo(x.mnozstvi), cena = cislo(x.cenaZaKus), sleva = cislo(x.sleva)
  if (mnozstvi !== undefined) {
    if (!Number.isFinite(mnozstvi) || mnozstvi <= 0) return 'Množství musí být kladné číslo'
    data.mnozstvi = mnozstvi
  }
  if (cena !== undefined) {
    if (!Number.isFinite(cena)) return 'Cena za kus musí být číslo'
    data.cenaZaKus = cena
  }
  if (sleva !== undefined) {
    if (!Number.isFinite(sleva) || sleva < 0 || sleva > 100) return 'Sleva musí být 0–100 %'
    data.sleva = sleva
  }
  if (x.jednotka !== undefined && String(x.jednotka).trim()) data.jednotka = String(x.jednotka).trim()
  return data
}

async function updateQuote(ctx: AiKontext, input: Record<string, unknown>): Promise<AiToolResult> {
  const q = await najdiNabidku(ctx, input.quoteId)
  if (!q) return chyba('Nabídka nenalezena nebo nemáš přístup')
  const db = orgPrisma(ctx.orgId)
  const zamek = await duvodZamkuNabidky(db, ctx.orgId, q)
  if (zamek) return chyba(zamek)

  // validace všeho předem — chybná operace nesmí nechat nabídku napůl upravenou
  const vlastni = new Set(q.items.map(i => i.id))
  const zmeny: ZmenaPolozky[] = []
  for (const x of (Array.isArray(input.update) ? input.update : []) as Record<string, unknown>[]) {
    const itemId = String(x?.itemId ?? '')
    if (!vlastni.has(itemId)) return chyba(`Položka ${itemId || '?'} v nabídce není`)
    const data = polePolozky(x)
    if (typeof data === 'string') return chyba(data)
    zmeny.push({ itemId, data })
  }
  const odebrat = (Array.isArray(input.remove) ? input.remove : []).map(String)
  for (const id of odebrat) if (!vlastni.has(id)) return chyba(`Položka ${id} v nabídce není`)
  const nove: NovaPolozka[] = []
  for (const x of (Array.isArray(input.add) ? input.add : []) as Record<string, unknown>[]) {
    const data = polePolozky(x ?? {})
    if (typeof data === 'string') return chyba(data)
    if (!data.nazev || data.mnozstvi === undefined || data.cenaZaKus === undefined) return chyba('Nová položka potřebuje název, množství a cenu')
    nove.push({
      nazev: data.nazev as string, mnozstvi: data.mnozstvi as number, cenaZaKus: data.cenaZaKus as number,
      jednotka: data.jednotka as string | undefined, sleva: (data.sleva as number | undefined) ?? 0,
      productId: x.productId ? String(x.productId) : undefined,
    })
  }
  const nazev = input.nazev !== undefined ? String(input.nazev).trim() : undefined
  if (nazev === '') return chyba('Název nabídky nesmí být prázdný')
  if (!zmeny.length && !nove.length && !odebrat.length && nazev === undefined) return chyba('Žádná změna')

  // produkty jen z katalogu vlastní firmy
  const productIds = nove.map(n => n.productId).filter((x): x is string => !!x)
  const vlastniProdukty = new Set((await db.product.findMany({ where: { orgId: ctx.orgId, id: { in: productIds } }, select: { id: true } })).map(p => p.id))
  const cizi = productIds.find(id => !vlastniProdukty.has(id))
  if (cizi) return chyba(`Produkt ${cizi} nenalezen v katalogu`)
  const produkty = await loadProductSnapshots(db, productIds)

  const predBezDph = quoteCelkemBezDph(q.items)
  let poradi = q.items.reduce((m, i) => Math.max(m, i.poradi), -1)
  await db.$transaction(async tx => {
    if (nazev !== undefined) await tx.quote.update({ where: { id: q.id }, data: { nazev } })
    for (const z of zmeny) await tx.quoteItem.updateMany({ where: { id: z.itemId, quoteId: q.id }, data: z.data })
    if (odebrat.length) await tx.quoteItem.deleteMany({ where: { id: { in: odebrat }, quoteId: q.id } })
    for (const n of nove) {
      const product = n.productId ? produkty.get(n.productId) : undefined
      await tx.quoteItem.create({
        data: {
          dealId: q.dealId, quoteId: q.id, productId: product ? n.productId : null, kod: product?.kod ?? null,
          nazev: n.nazev, mnozstvi: n.mnozstvi, cenaZaKus: n.cenaZaKus, sleva: n.sleva,
          jednotka: n.jednotka || product?.jednotka || 'ks',
          nakupniCena: resolveNakupniCena(undefined, product, ctx.perms),
          dphSazba: q.dphSazba, poradi: ++poradi,
        },
      })
    }
  })

  const po = (await najdiNabidku(ctx, q.id))!
  return {
    result: JSON.stringify({
      ok: true, quoteId: po.id, kod: po.kod, dealId: po.deal.id,
      zmeny: { upraveno: zmeny.length, pridano: nove.length, odebrano: odebrat.length, ...(nazev !== undefined ? { nazev } : {}) },
      puvodniCelkemBezDph: kc(predBezDph),
      celkemBezDph: kc(quoteCelkemBezDph(po.items)), celkemSDph: kc(quoteCelkemSDph(po.items, po.dphSazba)),
      pocetPolozek: po.items.length,
    }),
    navigateTo: `/deals/${po.deal.id}`,
  }
}

// ─── change_deal_client ─────────────────────────────────────────────────────

async function changeDealClient(ctx: AiKontext, input: Record<string, unknown>): Promise<AiToolResult> {
  const op = await najdiOp(ctx, input.dealId)
  if (!op) return chyba('OP nenalezen nebo nemáš přístup')
  const db = orgPrisma(ctx.orgId)
  const klient = await db.client.findFirst({
    where: { id: String(input.clientId ?? ''), orgId: ctx.orgId, anonymizedAt: null },
    select: { id: true, jmeno: true, prijmeni: true, ulice: true, mesto: true, psc: true, email: true, telefon: true, ico: true, dic: true },
  })
  if (!klient) return chyba('Klient nenalezen')
  if (klient.id === op.clientId) return chyba('OP už patří tomuto klientovi')

  const [zakazky, smlouvy] = await Promise.all([
    db.zakazka.findMany({ where: { orgId: ctx.orgId, opId: op.id }, select: { id: true, cislo: true, stav: true } }),
    db.sod.findMany({ where: { orgId: ctx.orgId, dealId: op.id }, select: { id: true, cislo: true, stav: true } }),
  ])
  const varovani = [
    ...zakazky.filter(z => z.stav === 'VYUCTOVANA' || z.stav === 'HOTOVO').map(z => `zakázka ${z.cislo} je ${z.stav === 'HOTOVO' ? 'hotová' : 'vyúčtovaná'}`),
    ...smlouvy.filter(s => (SOD_ZAMYKA as readonly string[]).includes(s.stav)).map(s => `smlouva ${s.cislo} je ${s.stav === 'PODEPSANO' ? 'podepsaná' : 'u podpisu'} s původním klientem`),
  ]
  if (varovani.length && input.force !== true) {
    return {
      result: JSON.stringify({
        chyba: `OP ${op.kod} nepřesunuto: ${varovani.join('; ')}. Nic se nezměnilo.`,
        varovani,
        napoveda: 'Přesun jde jen na výslovné přání uživatele s force=true; jinak založ nový OP a nabídku zkopíruj (copy_quote).',
      }),
    }
  }

  const navrhy = smlouvy.filter(s => s.stav === 'NAVRH')
  const adresa = [klient.ulice, klient.psc, klient.mesto].filter(Boolean).join(', ') || null
  await db.$transaction(async tx => {
    await tx.deal.update({ where: { id: op.id }, data: { clientId: klient.id } })
    if (zakazky.length) await tx.zakazka.updateMany({ where: { orgId: ctx.orgId, opId: op.id }, data: { klientId: klient.id } })
    // údaje klienta v návrzích smluv stejně jako /api/sod/prefill
    if (navrhy.length) {
      await tx.sod.updateMany({
        where: { orgId: ctx.orgId, id: { in: navrhy.map(s => s.id) } },
        data: {
          klientJmeno: klientJmeno(klient)!, klientAdresa: adresa, klientEmail: klient.email,
          klientTelefon: klient.telefon, klientIco: klient.ico, klientDic: klient.dic,
        },
      })
    }
    for (const z of zakazky) {
      await tx.auditLog.create({
        data: {
          orgId: ctx.orgId, userId: ctx.userId, typAkce: 'UPDATE', typZaznamu: 'Zakazka', zaznamId: z.id, zaznamNazev: z.cislo,
          zmeny: { klientPred: klientJmeno(op.client), klientPo: klientJmeno(klient), presunOp: op.kod }, actorType: 'ai', aiSource: ctx.zdroj,
        },
      })
    }
  })

  const upozorneni = [
    ...(navrhy.length ? [`V návrhu smlouvy ${navrhy.map(s => s.cislo).join(', ')} jsou nové údaje klienta, text smlouvy ale přegeneruj v detailu SOD.`] : []),
    ...(varovani.length ? [`Přesunuto přes varování: ${varovani.join('; ')}.`] : []),
    'Lead, servisní smlouvy a zařízení zůstaly u původního klienta.',
  ]
  return {
    result: JSON.stringify({
      ok: true, dealId: op.id, kod: op.kod, klientPred: klientJmeno(op.client), klientNovy: klientJmeno(klient), klientId: klient.id,
      presunuteZakazky: zakazky.map(z => z.cislo), upraveneSmlouvy: navrhy.map(s => s.cislo), upozorneni,
    }),
    navigateTo: `/deals/${op.id}`,
  }
}

// ─── Náhled pro potvrzovací kartu ───────────────────────────────────────────

export async function popisNabidkaAkce(ctx: AiKontext, name: string, input: Record<string, unknown>) {
  if (name === 'change_deal_client') {
    const op = await najdiOp(ctx, input.dealId)
    const k = await orgPrisma(ctx.orgId).client.findFirst({ where: { id: String(input.clientId ?? ''), orgId: ctx.orgId }, select: { jmeno: true, prijmeni: true } })
    return {
      titulek: 'Přesunout OP na jiného klienta',
      radky: [op ? `${op.kod} — ${op.predmet ?? ''}`.trim() : String(input.dealId ?? '?'), `${klientJmeno(op?.client) ?? '?'} → ${klientJmeno(k) ?? '?'}`],
    }
  }
  const q = await najdiNabidku(ctx, input.quoteId)
  const nabidka = q ? `${q.kod} — ${q.nazev} (${klientJmeno(q.deal.client) ?? ''})` : String(input.quoteId ?? '?')
  switch (name) {
    case 'copy_quote': {
      const op = await najdiOp(ctx, input.targetDealId)
      return { titulek: 'Zkopírovat nabídku', radky: [nabidka, `→ ${op ? `${op.kod} (${klientJmeno(op.client)})` : String(input.targetDealId ?? '?')}`] }
    }
    case 'delete_quote':
      return { titulek: 'Smazat nabídku', radky: [nabidka] }
    default: {
      const pocet = (k: string) => (Array.isArray(input[k]) ? (input[k] as unknown[]).length : 0)
      return {
        titulek: 'Upravit nabídku',
        radky: [nabidka, `změny ${pocet('update')} · nové ${pocet('add')} · odebrané ${pocet('remove')}${input.nazev ? ` · název „${String(input.nazev)}“` : ''}`],
      }
    }
  }
}

// ─── Spuštění ───────────────────────────────────────────────────────────────

export async function executeNabidkaTool(ctx: AiKontext, name: string, input: Record<string, unknown>): Promise<AiToolResult> {
  if (!ctx.perms.obchod) return chyba('Nemáš přístup k obchodu')
  const t0 = Date.now()
  let out: AiToolResult
  switch (name) {
    case 'get_quote': {
      const q = await najdiNabidku(ctx, input.quoteId)
      out = q ? ok(nabidkaVystup(q)) : chyba('Nabídka nenalezena nebo nemáš přístup')
      break
    }
    case 'update_quote':
      out = await updateQuote(ctx, input)
      break
    case 'copy_quote': {
      const q = await najdiNabidku(ctx, input.quoteId)
      if (!q) { out = chyba('Nabídka nenalezena nebo nemáš přístup'); break }
      const cil = await najdiOp(ctx, input.targetDealId)
      if (!cil) { out = chyba('Cílový OP nenalezen nebo nemáš přístup'); break }
      const nazev = String(input.nazev ?? '').trim() || `Kopie - ${q.nazev}`
      const kopie = await zkopirujNabidku(orgPrisma(ctx.orgId), { orgId: ctx.orgId, quote: q, targetDealId: cil.id, nazev })
      out = {
        result: JSON.stringify({
          ok: true, quoteId: kopie.id, kod: kopie.kod, nazev: kopie.nazev, dealId: cil.id, op: cil.kod, klient: klientJmeno(cil.client),
          celkemBezDph: kc(quoteCelkemBezDph(kopie.items)), pocetPolozek: kopie.items.length,
          puvodni: { kod: q.kod, celkemBezDph: kc(quoteCelkemBezDph(q.items)), pocetPolozek: q.items.length },
        }),
        navigateTo: `/deals/${cil.id}`,
      }
      break
    }
    case 'delete_quote': {
      const q = await najdiNabidku(ctx, input.quoteId)
      if (!q) { out = chyba('Nabídka nenalezena nebo nemáš přístup'); break }
      const duvod = duvodNelzeSmazat(q)
      if (duvod) { out = chyba(duvod); break }
      await orgPrisma(ctx.orgId).quote.delete({ where: { id: q.id } })
      out = { result: JSON.stringify({ ok: true, quoteId: q.id, kod: q.kod, nazev: q.nazev, dealId: q.deal.id }), navigateTo: `/deals/${q.deal.id}` }
      break
    }
    case 'change_deal_client':
      out = await changeDealClient(ctx, input)
      break
    default:
      out = chyba(`Neznámý nástroj: ${name}`)
  }
  console.log(`[mcp-nabidky] ${name} org=${ctx.orgId} user=${ctx.userId} ${Date.now() - t0}ms`)
  return out
}
