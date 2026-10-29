import type { Permissions } from '@/lib/permissions'
import { hasDeal } from '@/lib/activities'
import { orgPrisma } from '@/lib/orgPrisma'
import { generateQuoteKod } from '@/lib/quoteKod'
import { generateDealKod } from '@/lib/dealKod'
import { createWithUniqueKod } from '@/lib/uniqueKod'
import { Technologie, StavDealu, TypAktivity, TypKlienta } from '@prisma/client'
import { formatDate } from '@/lib/format'
import { vyhranoPriZmene } from '@/lib/dealUspech'
import { jeDuvodProhry, type DuvodProhryKod } from '@/lib/duvodProhry'
import { DIKTAT_WHERE, pripojDiktat } from '@/lib/diktat'
import { najdiVolajiciho } from '@/lib/zapisHovoru'
import { nactiZdroje, parseZdroj } from '@/lib/zdrojPoptavky'
import { getOrgSettings } from '@/lib/orgSettings'

// ─── Tool definitions ────────────────────────────────────────────────────────

export const DASA_TOOLS = [
  {
    name: 'search_deals',
    description: 'Hledej obchodní případy (OP) podle kódu, jména klienta nebo předmětu. Použij vždy, když potřebuješ UUID dealu před tvorbou nabídky nebo jiné akcí.',
    input_schema: {
      type: 'object' as const,
      properties: {
        q: { type: 'string', description: 'Kód OP (OP-26-081), jméno klienta nebo klíčové slovo' },
      },
      required: ['q'],
    },
  },
  {
    name: 'get_deal',
    description: 'Získej detail konkrétního OP — stav, nabídky, aktivity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dealId: { type: 'string', description: 'UUID nebo kód OP (např. OP-26-081)' },
      },
      required: ['dealId'],
    },
  },
  {
    name: 'search_clients',
    description: 'Hledej klienty podle jména, příjmení nebo emailu.',
    input_schema: {
      type: 'object' as const,
      properties: {
        q: { type: 'string', description: 'Jméno, příjmení nebo email' },
      },
      required: ['q'],
    },
  },
  {
    name: 'search_products',
    description: 'Hledej produkty v katalogu. Vrací ID, název, cenu, jednotku.',
    input_schema: {
      type: 'object' as const,
      properties: {
        q: { type: 'string', description: 'Název nebo kód produktu' },
      },
      required: ['q'],
    },
  },
  {
    name: 'list_quote_templates',
    description: 'Seznam vzorových nabídek (šablon CN) — id, název, technologie, počet položek. Použij vždy, když má vzniknout rychlá cenovka ze vzoru (klimatizace apod.).',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_quote_template',
    description: 'Kompletní položky vzorové nabídky ve formátu pro create_quote. Položky převezmi, uprav množství podle zadání (např. metry Cu potrubí) a přidej další položky z katalogu (např. konkrétní jednotku klimatizace).',
    input_schema: {
      type: 'object' as const,
      properties: {
        templateId: { type: 'string', description: 'ID vzorové nabídky z list_quote_templates' },
      },
      required: ['templateId'],
    },
  },
  {
    name: 'get_briefing',
    description: 'Vrátí přehled pro aktuálního uživatele: nesplněné úkoly, aktivity tento týden, OP bez aktivity déle než 7 dní.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'create_quote',
    description: 'Vytvoř cenovou nabídku (CN) k obchodnímu případu s položkami. Nevyžaduje potvrzení — akci proveď přímo.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dealId: { type: 'string', description: 'UUID nebo kód OP (OP-26-081)' },
        nazev: { type: 'string', description: 'Název nabídky, výchozí: Varianta A' },
        items: {
          type: 'array',
          description: 'Položky nabídky',
          items: {
            type: 'object',
            properties: {
              nazev: { type: 'string' },
              mnozstvi: { type: 'number' },
              cenaZaKus: { type: 'number' },
              jednotka: { type: 'string', description: 'Výchozí: ks' },
              productId: { type: 'string', description: 'ID z katalogu — nepovinné' },
            },
            required: ['nazev', 'mnozstvi', 'cenaZaKus'],
          },
        },
      },
      required: ['dealId', 'items'],
    },
  },
  {
    name: 'create_deal',
    description: 'Vytvoř nový obchodní případ (OP) pro existujícího klienta. Vyžaduje potvrzení uživatele.',
    input_schema: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'string', description: 'UUID klienta' },
        technologie: { type: 'string', description: 'KLIMA | TEPELNE_CERPADLO | REKUPERACE | PODLAHOVE_TOPENI | VZDUCHOTECHNIKA | JINE' },
        predmet: { type: 'string', description: 'Stručný popis' },
      },
      required: ['clientId', 'technologie'],
    },
  },
  {
    name: 'create_client',
    description: 'Vytvoř nového klienta. Vyžaduje potvrzení uživatele.',
    input_schema: {
      type: 'object' as const,
      properties: {
        typKlienta: { type: 'string', description: 'FYZICKA_OSOBA | FIRMA' },
        jmeno: { type: 'string' },
        prijmeni: { type: 'string', description: 'Pro firmu prázdný string' },
        telefon: { type: 'string' },
        email: { type: 'string' },
      },
      required: ['typKlienta', 'jmeno'],
    },
  },
  {
    name: 'add_activity',
    description: 'Přidej aktivitu (úkol, schůzku, hovor, poznámku) k obchodnímu případu.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dealId: { type: 'string', description: 'UUID obchodního případu' },
        typ: { type: 'string', description: 'HOVOR | EMAIL | SCHUZKA | UKOL | POZNAMKA' },
        datum: { type: 'string', description: 'ISO datetime, např. 2026-06-10T10:00:00' },
        popis: { type: 'string', description: 'Popis aktivity' },
      },
      required: ['dealId', 'typ', 'datum', 'popis'],
    },
  },
  {
    name: 'change_deal_status',
    description: 'Změň stav obchodního případu.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dealId: { type: 'string', description: 'UUID obchodního případu' },
        stav: { type: 'string', description: 'NOVY | JEDNANI | NABIDKA | PRED_UZAVRENIM | USPECH | PAS' },
        duvodProhryKod: { type: 'string', description: 'Povinné u PAS: CENA | KONKURENCE | ODLOZENO | NEREAGOVAL | JINE — nevíš-li, zeptej se uživatele' },
        duvodProhry: { type: 'string', description: 'Volitelný popis důvodu prohry' },
      },
      required: ['dealId', 'stav'],
    },
  },
  {
    name: 'get_diktat',
    description: 'Načti text nezpracovaného diktátu podle ID (zpráva uživatele obsahuje [diktat:ID]).',
    input_schema: {
      type: 'object' as const,
      properties: { diktatId: { type: 'string', description: 'ID diktátu' } },
      required: ['diktatId'],
    },
  },
  {
    name: 'find_by_phone',
    description: 'Najdi klienty (s otevřenými OP) a leady podle telefonního čísla. Použij vždy, když diktát obsahuje telefon.',
    input_schema: {
      type: 'object' as const,
      properties: { telefon: { type: 'string', description: 'Telefonní číslo v libovolném formátu' } },
      required: ['telefon'],
    },
  },
  {
    name: 'search_leads',
    description: 'Hledej leady (poptávky) podle jména, firmy, e-mailu nebo telefonu.',
    input_schema: {
      type: 'object' as const,
      properties: { q: { type: 'string', description: 'Jméno, firma, e-mail nebo telefon' } },
      required: ['q'],
    },
  },
  {
    name: 'list_zdroje_poptavky',
    description: 'Číselník zdrojů poptávky (odkud o nás zákazník ví) — potřebuješ ID pro create_lead.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'create_lead',
    description: 'Založ nový lead (poptávku). Vyžaduje potvrzení uživatele. Když je modul KPI zapnutý, je zdroj poptávky povinný — nevíš-li ho z diktátu, zeptej se.',
    input_schema: {
      type: 'object' as const,
      properties: {
        jmeno: { type: 'string', description: 'Jméno a příjmení kontaktu' },
        firma: { type: 'string' },
        telefon: { type: 'string' },
        email: { type: 'string' },
        zprava: { type: 'string', description: 'Co zákazník chce — stručné shrnutí poptávky' },
        zdrojPoptavkyId: { type: 'string', description: 'ID z list_zdroje_poptavky' },
      },
      required: ['jmeno'],
    },
  },
  {
    name: 'pripojit_diktat',
    description: 'Připoj zpracovaný diktát k leadu nebo OP — v historii se z něj stane hovor a zmizí z úkolů. Zadej právě jedno z dealId / leadId. Proveď hned po založení nebo nalezení leadu/OP.',
    input_schema: {
      type: 'object' as const,
      properties: {
        diktatId: { type: 'string' },
        dealId: { type: 'string', description: 'UUID OP' },
        leadId: { type: 'string', description: 'UUID leadu' },
      },
      required: ['diktatId'],
    },
  },
]

// ─── Tool execution (server-side, always scoped to org + oprávnění) ──────────

export interface DasaUser {
  id: string
  orgId: string
  role: string
  jmeno: string
  perms: Permissions
}

export async function executeDasaTool(
  name: string,
  input: Record<string, unknown>,
  user: DasaUser
): Promise<{ result: string; navigateTo?: string }> {
  const { orgId, id: userId, perms } = user
  const db = orgPrisma(orgId)
  // bez obchodu = „technik": jen čtení katalogu bez cen, žádné OP/klienti
  const isTechnik = !perms.obchod
  // vidí jen vlastní OP
  const isObchodnik = !perms.obchodCiziOP
  const canCreate = !isTechnik

  try {
    switch (name) {

      case 'search_deals': {
        const q = String(input.q ?? '').trim()
        const isUuid = /^[0-9a-f-]{36}$/i.test(q)
        const isOpKod = /^OP-\d{2}-\d{3}$/i.test(q)

        const deals = await db.deal.findMany({
          where: {
            orgId,
            stav: { not: 'ZNEPLATNENO' },
            // rozsah obchodníka platí i pro hledání podle ID / kódu OP
            ...(isObchodnik ? { userId } : {}),
            ...(isUuid ? { id: q } : isOpKod ? { kod: q } : {
              OR: [
                { kod: { contains: q, mode: 'insensitive' } },
                { predmet: { contains: q, mode: 'insensitive' } },
                { client: { jmeno: { contains: q, mode: 'insensitive' } } },
                { client: { prijmeni: { contains: q, mode: 'insensitive' } } },
              ],
            }),
          },
          select: {
            id: true, kod: true, predmet: true, technologie: true, stav: true,
            client: { select: { jmeno: true, prijmeni: true } },
          },
          take: 8,
          orderBy: { vytvoreno: 'desc' },
        })

        if (deals.length === 0) return { result: JSON.stringify({ zprava: 'Žádné OP nenalezeny' }) }
        return {
          result: JSON.stringify(deals.map(d => ({
            id: d.id, kod: d.kod, predmet: d.predmet, technologie: d.technologie,
            stav: d.stav,
            klient: d.client ? `${d.client.jmeno} ${d.client.prijmeni ?? ''}`.trim() : '?',
          }))),
        }
      }

      case 'get_deal': {
        const rawId = String(input.dealId ?? '').trim()
        const isUuid = /^[0-9a-f-]{36}$/i.test(rawId)

        const deal = await db.deal.findFirst({
          where: {
            orgId,
            ...(isUuid ? { id: rawId } : { kod: rawId }),
            ...(isObchodnik ? { userId } : {}),
          },
          include: {
            client: { select: { id: true, jmeno: true, prijmeni: true, email: true, telefon: true } },
            quotes: {
              select: {
                id: true, kod: true, nazev: true, aktivni: true,
                items: { select: { nazev: true, mnozstvi: true, cenaZaKus: true, jednotka: true }, orderBy: { poradi: 'asc' } },
              },
              take: 5,
            },
            activities: { orderBy: { datum: 'desc' }, take: 5, select: { typ: true, datum: true, popis: true } },
          },
        })

        if (!deal) return { result: JSON.stringify({ chyba: 'OP nenalezen nebo nemáš přístup' }) }

        const result: Record<string, unknown> = {
          id: deal.id, kod: deal.kod, predmet: deal.predmet,
          technologie: deal.technologie, stav: deal.stav,
          klientId: deal.client?.id,
          klient: deal.client ? `${deal.client.jmeno} ${deal.client.prijmeni ?? ''}`.trim() : '?',
          aktivity: deal.activities.map(a => ({
            typ: a.typ, datum: formatDate(a.datum), popis: a.popis,
          })),
        }
        if (!isTechnik) {
          result.nabidky = deal.quotes.map(q => {
            const total = q.items.reduce((s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus), 0)
            return { id: q.id, kod: q.kod, nazev: q.nazev, aktivni: q.aktivni, celkem: total }
          })
        }
        return { result: JSON.stringify(result) }
      }

      case 'search_clients': {
        if (isTechnik) return { result: JSON.stringify({ chyba: 'Nedostatečná oprávnění' }) }
        const q = String(input.q ?? '').trim()

        const clients = await db.client.findMany({
          where: {
            orgId,
            OR: [
              { jmeno: { contains: q, mode: 'insensitive' } },
              { prijmeni: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: { id: true, jmeno: true, prijmeni: true, email: true, telefon: true, typKlienta: true },
          take: 8,
        })

        if (clients.length === 0) return { result: JSON.stringify({ zprava: 'Žádní klienti nenalezeni' }) }
        return { result: JSON.stringify(clients) }
      }

      case 'search_products': {
        const q = String(input.q ?? '').trim()
        const keywords = q.split(/\s+/).filter(k => k.length > 2).slice(0, 3)
        if (keywords.length === 0) return { result: JSON.stringify({ zprava: 'Zadej hledaný výraz' }) }

        const searches = keywords.map(kw =>
          db.product.findMany({
            where: {
              orgId, aktivni: true,
              OR: [
                { nazev: { contains: kw, mode: 'insensitive' } },
                { kod: { contains: kw, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true, nazev: true, kod: true, jednotka: true,
              ...(isTechnik ? {} : { standardniCena: true }),
            },
            take: 6,
          })
        )

        const results = await Promise.all(searches)
        const seen = new Set<string>()
        const merged = results.flat().filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true })

        if (merged.length === 0) return { result: JSON.stringify({ zprava: 'Žádné produkty nenalezeny' }) }
        return { result: JSON.stringify(merged) }
      }

      case 'list_quote_templates': {
        if (isTechnik) return { result: JSON.stringify({ chyba: 'Nedostatečná oprávnění' }) }

        const templates = await db.quoteTemplate.findMany({
          where: { orgId },
          select: { id: true, nazev: true, popis: true, technologie: true, polozky: true },
          orderBy: { nazev: 'asc' },
        })

        // Šablony bez položek jsou render/PDF šablony — jako vzor nabídky nedávají smysl
        const seVzorem = templates.filter(t => Array.isArray(t.polozky) && t.polozky.length > 0)
        if (seVzorem.length === 0) return { result: JSON.stringify({ zprava: 'Žádné vzorové nabídky' }) }
        return {
          result: JSON.stringify(seVzorem.map(t => ({
            id: t.id, nazev: t.nazev, popis: t.popis, technologie: t.technologie,
            pocetPolozek: (t.polozky as unknown[]).length,
          }))),
        }
      }

      case 'get_quote_template': {
        if (isTechnik) return { result: JSON.stringify({ chyba: 'Nedostatečná oprávnění' }) }

        const templateId = String(input.templateId ?? '').trim()
        const template = await db.quoteTemplate.findFirst({ where: { id: templateId, orgId } })
        if (!template) return { result: JSON.stringify({ chyba: 'Vzorová nabídka nenalezena' }) }

        const polozky = Array.isArray(template.polozky) ? template.polozky as Record<string, unknown>[] : []
        return {
          result: JSON.stringify({
            id: template.id,
            nazev: template.nazev,
            technologie: template.technologie,
            items: polozky.map(p => ({
              nazev: String(p.nazev ?? ''),
              mnozstvi: Number(p.mnozstvi ?? 1),
              cenaZaKus: Number(p.cena_za_kus ?? 0),
              jednotka: String(p.jednotka ?? 'ks'),
              ...(p.product_id ? { productId: String(p.product_id) } : {}),
            })),
          }),
        }
      }

      case 'get_briefing': {
        const now = new Date()
        const WEEKDAYS = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota']
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
        weekStart.setHours(0, 0, 0, 0)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        weekEnd.setHours(23, 59, 59, 999)

        const obchodnikFilter = isObchodnik ? { userId } : {}

        const [ukoly, aktivityTyden, allDeals] = await Promise.all([
          db.activity.findMany({
            where: { deal: { orgId }, userId, typ: 'UKOL', splneno: false },
            include: { deal: { select: { kod: true, predmet: true, client: { select: { jmeno: true } } } } },
            orderBy: { datum: 'asc' },
            take: 10,
          }),
          db.activity.findMany({
            where: { deal: { orgId, ...obchodnikFilter }, userId, datum: { gte: weekStart, lte: weekEnd } },
            include: { deal: { select: { kod: true, client: { select: { jmeno: true } } } } },
            orderBy: { datum: 'asc' },
            take: 20,
          }),
          db.deal.findMany({
            where: { orgId, stav: { notIn: ['USPECH', 'PAS', 'ZNEPLATNENO'] }, ...obchodnikFilter },
            include: { client: { select: { jmeno: true } }, activities: { orderBy: { datum: 'desc' }, take: 1 } },
            take: 20,
          }),
        ])

        const bezAktivity = allDeals.filter(d => {
          const last = d.activities[0]?.datum
          return !last || (now.getTime() - new Date(last).getTime()) > 7 * 24 * 60 * 60 * 1000
        })

        return {
          result: JSON.stringify({
            datum: `${formatDate(now)} (${WEEKDAYS[now.getDay()]})`,
            ukoly: ukoly.filter(hasDeal).map(u => ({
              deal: u.deal.kod, klient: u.deal.client.jmeno,
              popis: u.popis, termin: formatDate(u.datum),
            })),
            aktivityTyden: aktivityTyden.filter(hasDeal).map(a => ({
              datum: formatDate(a.datum), typ: a.typ,
              deal: a.deal.kod, klient: a.deal.client?.jmeno ?? '?',
            })),
            opBezAktivity: bezAktivity.slice(0, 6).map(d => ({
              id: d.id, kod: d.kod, klient: d.client.jmeno, predmet: d.predmet,
            })),
          }),
        }
      }

      case 'create_quote': {
        if (!canCreate) return { result: JSON.stringify({ chyba: 'Nedostatečná oprávnění — techniku nelze vytvářet nabídky' }) }

        let dealId = String(input.dealId ?? '').trim()
        const isUuid = /^[0-9a-f-]{36}$/i.test(dealId)

        if (!isUuid) {
          const normalized = dealId.toUpperCase().startsWith('OP-') ? dealId.toUpperCase() : `OP-${dealId}`
          const found = await db.deal.findFirst({ where: { kod: normalized, orgId, ...(isObchodnik ? { userId } : {}) } })
          if (!found) return { result: JSON.stringify({ chyba: `OP ${normalized} nenalezen` }) }
          dealId = found.id
        } else {
          const found = await db.deal.findFirst({ where: { id: dealId, orgId, ...(isObchodnik ? { userId } : {}) } })
          if (!found) return { result: JSON.stringify({ chyba: 'OP nenalezen' }) }
        }

        const items = Array.isArray(input.items) ? input.items as Record<string, unknown>[] : []
        if (items.length === 0) return { result: JSON.stringify({ chyba: 'Nabídka musí mít alespoň jednu položku' }) }

        // productId jen z vlastního katalogu (RLS cizí FK nehlídá)
        const chteneProdukty = Array.from(new Set(items.map(i => i.productId).filter(Boolean).map(String)))
        const vlastniProdukty = new Set(chteneProdukty.length
          ? (await db.product.findMany({ where: { id: { in: chteneProdukty } }, select: { id: true } })).map(p => p.id)
          : [])

        const quote = await createWithUniqueKod(
          () => generateQuoteKod(orgId),
          kod => db.quote.create({
            data: {
              dealId, orgId,
              nazev: String(input.nazev ?? 'Varianta A'),
              kod, dphSazba: 12, aktivni: false,
              items: {
                create: items.map((item, idx) => ({
                  dealId,
                  nazev: String(item.nazev ?? ''),
                  mnozstvi: Number(item.mnozstvi ?? 1),
                  cenaZaKus: Number(item.cenaZaKus ?? 0),
                  jednotka: String(item.jednotka ?? 'ks'),
                  sleva: 0,
                  productId: item.productId && vlastniProdukty.has(String(item.productId)) ? String(item.productId) : null,
                  poradi: idx,
                })),
              },
            },
            include: { items: true },
          }),
        )

        const total = quote.items.reduce((s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus), 0)
        return {
          result: JSON.stringify({
            ok: true, quoteId: quote.id, kod: quote.kod, nazev: quote.nazev, dealId,
            celkemBezDph: total, pocetPolozek: quote.items.length,
          }),
          navigateTo: `/deals/${dealId}`,
        }
      }

      case 'create_deal': {
        if (!canCreate) return { result: JSON.stringify({ chyba: 'Nedostatečná oprávnění' }) }

        const clientId = String(input.clientId ?? '')
        const technologie = String(input.technologie ?? 'JINE')
        const predmet = input.predmet ? String(input.predmet) : null

        const client = await db.client.findFirst({ where: { id: clientId, orgId } })
        if (!client) return { result: JSON.stringify({ chyba: 'Klient nenalezen' }) }

        const deal = await createWithUniqueKod(
          () => generateDealKod(orgId),
          kod => db.deal.create({
            data: { orgId, userId, clientId, technologie: technologie as Technologie, predmet, kod, stav: 'NOVY' },
          }),
        )

        return { result: JSON.stringify({ ok: true, dealId: deal.id, kod: deal.kod }), navigateTo: `/deals/${deal.id}` }
      }

      case 'create_client': {
        if (!canCreate) return { result: JSON.stringify({ chyba: 'Nedostatečná oprávnění' }) }

        const typKlienta = String(input.typKlienta ?? 'FYZICKA_OSOBA')
        const jmeno = String(input.jmeno ?? '').trim()
        const prijmeni = input.prijmeni ? String(input.prijmeni).trim() : ''
        if (!jmeno) return { result: JSON.stringify({ chyba: 'Jméno klienta je povinné' }) }

        const client = await db.client.create({
          data: {
            orgId,
            typKlienta: typKlienta as TypKlienta,
            jmeno, prijmeni,
            telefon: input.telefon ? String(input.telefon) : null,
            email: input.email ? String(input.email) : null,
          },
        })

        const nazev = typKlienta === 'FIRMA' ? jmeno : `${jmeno} ${prijmeni}`.trim()
        return {
          result: JSON.stringify({ ok: true, clientId: client.id, nazev }),
          navigateTo: `/clients/${client.id}`,
        }
      }

      case 'add_activity': {
        const dealId = String(input.dealId ?? '')
        const deal = await db.deal.findFirst({
          where: { id: dealId, orgId, ...(isObchodnik ? { userId } : {}) },
        })
        if (!deal) return { result: JSON.stringify({ chyba: 'OP nenalezen nebo nemáš přístup' }) }

        const aktivita = await db.activity.create({
          data: {
            orgId, dealId, userId,
            typ: String(input.typ ?? 'POZNAMKA') as TypAktivity,
            datum: new Date(String(input.datum ?? new Date().toISOString())),
            popis: String(input.popis ?? ''),
          },
        })

        return { result: JSON.stringify({ ok: true, activityId: aktivita.id, dealId, kod: deal.kod }) }
      }

      case 'change_deal_status': {
        if (isTechnik) return { result: JSON.stringify({ chyba: 'Nedostatečná oprávnění' }) }

        const dealId = String(input.dealId ?? '')
        const stav = String(input.stav ?? '')

        const deal = await db.deal.findFirst({
          where: { id: dealId, orgId, ...(isObchodnik ? { userId } : {}) },
        })
        if (!deal) return { result: JSON.stringify({ chyba: 'OP nenalezen nebo nemáš přístup' }) }

        // Prohraný OP jen s důvodem (procesní mapa 1.6), stejně jako web a mobil
        const duvodText = String(input.duvodProhry ?? '').trim() || null
        if (stav === 'PAS' && deal.stav !== 'PAS' && !jeDuvodProhry(input.duvodProhryKod)) {
          return { result: JSON.stringify({ chyba: 'U prohry je povinný důvod — zeptej se uživatele (cena, konkurence, odloženo, nereagoval, jiné + popis).' }) }
        }

        await db.deal.update({
          where: { id: dealId },
          data: {
            stav: stav as StavDealu,
            ...vyhranoPriZmene(deal.stav, stav),
            ...(stav === 'PAS' && deal.stav !== 'PAS' ? { duvodProhryKod: input.duvodProhryKod as DuvodProhryKod, duvodProhry: duvodText } : {}),
            ...(stav !== 'PAS' && deal.stav === 'PAS' ? { duvodProhryKod: null, duvodProhry: null } : {}),
          },
        })

        return { result: JSON.stringify({ ok: true, novyStav: stav }), navigateTo: `/deals/${dealId}` }
      }

      case 'get_diktat': {
        if (isTechnik) return { result: JSON.stringify({ chyba: 'Nedostatečná oprávnění' }) }
        const d = await db.activity.findFirst({
          where: { id: String(input.diktatId ?? ''), orgId, ...DIKTAT_WHERE },
          select: { id: true, popis: true, vytvoreno: true, datum: true },
        })
        if (!d) return { result: JSON.stringify({ chyba: 'Diktát nenalezen nebo už je zpracovaný' }) }
        return { result: JSON.stringify({ diktatId: d.id, text: d.popis, nadiktovano: formatDate(d.vytvoreno), ukolNa: formatDate(d.datum) }) }
      }

      case 'find_by_phone': {
        if (isTechnik) return { result: JSON.stringify({ chyba: 'Nedostatečná oprávnění' }) }
        const shody = await najdiVolajiciho(db, orgId, String(input.telefon ?? ''), isObchodnik ? { userId } : {})
        if (!shody.klienti.length && !shody.leady.length) return { result: JSON.stringify({ zprava: 'Číslo v CRM není' }) }
        return { result: JSON.stringify(shody) }
      }

      case 'search_leads': {
        if (isTechnik) return { result: JSON.stringify({ chyba: 'Nedostatečná oprávnění' }) }
        const q = String(input.q ?? '').trim()
        if (!q) return { result: JSON.stringify({ zprava: 'Zadej hledaný výraz' }) }
        const leady = await db.lead.findMany({
          where: {
            orgId,
            OR: [
              { jmeno: { contains: q, mode: 'insensitive' } },
              { firma: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { telefon: { contains: q } },
            ],
          },
          select: { id: true, jmeno: true, firma: true, telefon: true, email: true, status: true, vytvoreno: true, prevedenNaOpId: true },
          orderBy: { vytvoreno: 'desc' },
          take: 8,
        })
        if (!leady.length) return { result: JSON.stringify({ zprava: 'Žádné leady nenalezeny' }) }
        return { result: JSON.stringify(leady) }
      }

      case 'list_zdroje_poptavky': {
        const zdroje = (await nactiZdroje(db, orgId)).filter(z => z.aktivni)
        const povinny = (await getOrgSettings(orgId)).modulKpi
        return { result: JSON.stringify({ povinnyULeadu: povinny, zdroje: zdroje.map(z => ({ id: z.id, nazev: z.nazev })) }) }
      }

      case 'create_lead': {
        if (!canCreate) return { result: JSON.stringify({ chyba: 'Nedostatečná oprávnění' }) }
        const jmeno = String(input.jmeno ?? '').trim()
        if (!jmeno) return { result: JSON.stringify({ chyba: 'Jméno je povinné' }) }
        const zdroj = await parseZdroj(db, orgId, { zdrojPoptavkyId: input.zdrojPoptavkyId ?? null })
        if (typeof zdroj === 'string') return { result: JSON.stringify({ chyba: zdroj }) }
        if (!zdroj.zdrojPoptavkyId && (await getOrgSettings(orgId)).modulKpi) {
          return { result: JSON.stringify({ chyba: 'Chybí zdroj poptávky — zeptej se uživatele, odkud o nás zákazník ví (list_zdroje_poptavky).' }) }
        }
        const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
        const lead = await db.lead.create({
          data: {
            orgId, jmeno: jmeno.slice(0, 200),
            firma: text(input.firma, 200), telefon: text(input.telefon, 50), email: text(input.email, 200),
            zprava: text(input.zprava, 2000),
            zdroj: 'RUCNE', status: 'NOVY', assignedToId: userId,
            ...zdroj,
          },
        })
        return { result: JSON.stringify({ ok: true, leadId: lead.id }), navigateTo: `/leady/${lead.id}` }
      }

      case 'pripojit_diktat': {
        if (!canCreate) return { result: JSON.stringify({ chyba: 'Nedostatečná oprávnění' }) }
        const diktatId = String(input.diktatId ?? '')
        const dealId = typeof input.dealId === 'string' && input.dealId ? input.dealId : null
        const leadId = typeof input.leadId === 'string' && input.leadId ? input.leadId : null
        if (!dealId === !leadId) return { result: JSON.stringify({ chyba: 'Zadej právě jedno z dealId / leadId' }) }
        if (dealId && !(await db.deal.findFirst({ where: { id: dealId, orgId, ...(isObchodnik ? { userId } : {}) }, select: { id: true } }))) {
          return { result: JSON.stringify({ chyba: 'OP nenalezen nebo nemáš přístup' }) }
        }
        const chyba = await pripojDiktat(db, orgId, diktatId, dealId ? { dealId } : { leadId: leadId! })
        if (chyba) return { result: JSON.stringify({ chyba }) }
        return { result: JSON.stringify({ ok: true }), navigateTo: dealId ? `/deals/${dealId}?tab=aktivity` : `/leady/${leadId}` }
      }

      default:
        return { result: JSON.stringify({ chyba: `Neznámý nástroj: ${name}` }) }
    }
  } catch (err) {
    console.error(`[dasa-tool:${name}] error:`, err)
    return { result: JSON.stringify({ chyba: 'Chyba při provádění akce. Zkus to znovu.' }) }
  }
}
