import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPlanLimits } from '@/lib/planLimits'
import { checkRateLimit } from '@/lib/rateLimit'
import { Technologie, StavDealu, TypAktivity, TypKlienta } from '@prisma/client'

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
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
      },
      required: ['dealId', 'stav'],
    },
  },
]

// ─── Tool execution (server-side, always scoped to org + role) ───────────────

interface SessionUser {
  id: string
  orgId: string
  role: string
  jmeno: string
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  user: SessionUser
): Promise<{ result: string; navigateTo?: string }> {
  const { orgId, id: userId, role } = user
  const db = orgPrisma(orgId)
  const isTechnik = role === 'TECHNIK'
  const isObchodnik = role === 'OBCHODNIK'
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
            ...(isUuid ? { id: q } : isOpKod ? { kod: q } : {
              ...(isObchodnik ? { userId } : {}),
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
            typ: a.typ, datum: new Date(a.datum).toLocaleDateString('cs-CZ'), popis: a.popis,
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
            datum: `${now.toLocaleDateString('cs-CZ')} (${WEEKDAYS[now.getDay()]})`,
            ukoly: ukoly.map(u => ({
              deal: u.deal.kod, klient: u.deal.client.jmeno,
              popis: u.popis, termin: new Date(u.datum).toLocaleDateString('cs-CZ'),
            })),
            aktivityTyden: aktivityTyden.map(a => ({
              datum: new Date(a.datum).toLocaleDateString('cs-CZ'), typ: a.typ,
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
          const found = await db.deal.findFirst({ where: { kod: normalized, orgId } })
          if (!found) return { result: JSON.stringify({ chyba: `OP ${normalized} nenalezen` }) }
          dealId = found.id
        } else {
          const found = await db.deal.findFirst({ where: { id: dealId, orgId } })
          if (!found) return { result: JSON.stringify({ chyba: 'OP nenalezen' }) }
        }

        const items = Array.isArray(input.items) ? input.items as Record<string, unknown>[] : []
        if (items.length === 0) return { result: JSON.stringify({ chyba: 'Nabídka musí mít alespoň jednu položku' }) }

        const count = await db.quote.count({ where: { dealId } })
        const kod = `NAB-${String(count + 1).padStart(2, '0')}`

        const quote = await db.quote.create({
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
                productId: item.productId ? String(item.productId) : null,
                poradi: idx,
              })),
            },
          },
          include: { items: true },
        })

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

        const yr = new Date().getFullYear() % 100
        const prefix = `OP-${yr.toString().padStart(2, '0')}-`
        const last = await db.deal.findFirst({
          where: { orgId, kod: { startsWith: prefix } },
          orderBy: { kod: 'desc' }, select: { kod: true },
        })
        const lastNum = last?.kod ? parseInt(last.kod.replace(prefix, ''), 10) : 0
        const kod = `${prefix}${(lastNum + 1).toString().padStart(3, '0')}`

        const deal = await db.deal.create({
          data: { orgId, userId, clientId, technologie: technologie as Technologie, predmet, kod, stav: 'NOVY' },
        })

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

        await db.activity.create({
          data: {
            dealId, userId,
            typ: String(input.typ ?? 'POZNAMKA') as TypAktivity,
            datum: new Date(String(input.datum ?? new Date().toISOString())),
            popis: String(input.popis ?? ''),
          },
        })

        return { result: JSON.stringify({ ok: true }) }
      }

      case 'change_deal_status': {
        if (isTechnik) return { result: JSON.stringify({ chyba: 'Nedostatečná oprávnění' }) }

        const dealId = String(input.dealId ?? '')
        const stav = String(input.stav ?? '')

        const deal = await db.deal.findFirst({
          where: { id: dealId, orgId, ...(isObchodnik ? { userId } : {}) },
        })
        if (!deal) return { result: JSON.stringify({ chyba: 'OP nenalezen nebo nemáš přístup' }) }

        await db.deal.update({
          where: { id: dealId },
          data: { stav: stav as StavDealu },
        })

        return { result: JSON.stringify({ ok: true, novyStav: stav }), navigateTo: `/deals/${dealId}` }
      }

      default:
        return { result: JSON.stringify({ chyba: `Neznámý nástroj: ${name}` }) }
    }
  } catch (err) {
    console.error(`[dasa-tool:${name}] error:`, err)
    return { result: JSON.stringify({ chyba: 'Chyba při provádění akce. Zkus to znovu.' }) }
  }
}

// ─── Credit calculation ───────────────────────────────────────────────────────

function calcCredits(inputTokens: number, outputTokens: number, cacheReadTokens: number): number {
  // Output is 5× more expensive than input; cache reads are near-free (10%)
  const effective = (inputTokens - cacheReadTokens) + cacheReadTokens * 0.1 + outputTokens * 5
  return Math.max(1, Math.ceil(effective / 1000))
}

// ─── GET — token/credit status ────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const org = await db.organization.findUnique({ where: { id: orgId } })
  const planLimits = getPlanLimits(org?.plan ?? 'STARTER')

  const creditsUsed = org?.aiCreditsUsed ?? 0
  const creditsExtra = org?.aiCreditsExtra ?? 0
  const creditsLimit = planLimits.aiCreditsPerMonth

  return NextResponse.json({
    canUseAI: planLimits.canUseAI,
    creditsUsed,
    creditsLimit: creditsLimit === Infinity ? null : creditsLimit,
    creditsTotal: creditsLimit === Infinity ? null : (creditsLimit as number) + creditsExtra,
    // legacy fields for backwards compat
    tokensUsed: org?.aiTokensUsed ?? 0,
    tokenLimit: planLimits.aiTokensPerMonth === Infinity ? null : planLimits.aiTokensPerMonth,
  })
}

// ─── POST — agentic loop ──────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { limited } = checkRateLimit(`ai-assistant:${session.user.id}`, 30, 60 * 1000)
  if (limited) return NextResponse.json({ error: 'Příliš mnoho požadavků. Zkuste to za chvíli.' }, { status: 429 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const org = await db.organization.findUnique({ where: { id: orgId } })
  const planLimits = getPlanLimits(org?.plan ?? 'STARTER')

  if (!planLimits.canUseAI) {
    return NextResponse.json({ error: 'AI asistentka není dostupná na vašem plánu.' }, { status: 403 })
  }

  // Monthly reset
  const now = new Date()
  const resetAt = org?.aiTokensResetAt ?? now
  const monthsElapsed = (now.getFullYear() - resetAt.getFullYear()) * 12 + (now.getMonth() - resetAt.getMonth())
  if (monthsElapsed >= 1) {
    await db.organization.update({
      where: { id: orgId },
      data: { aiTokensUsed: 0, aiCreditsUsed: 0, aiTokensResetAt: now },
    })
    if (org) { org.aiTokensUsed = 0; org.aiCreditsUsed = 0 }
  }

  // Credit limit check
  const creditsUsed = org?.aiCreditsUsed ?? 0
  const creditsExtra = org?.aiCreditsExtra ?? 0
  const creditsLimit = planLimits.aiCreditsPerMonth
  const creditsTotal = creditsLimit === Infinity ? Infinity : (creditsLimit as number) + creditsExtra
  if (creditsTotal !== Infinity && creditsUsed >= creditsTotal) {
    return NextResponse.json({
      error: `Vyčerpali jste měsíční limit AI kreditů (${creditsUsed}/${creditsTotal}). Limit se obnoví příští měsíc nebo dokupte kredity v nastavení.`,
    }, { status: 429 })
  }

  const body = await req.json()
  const { message, context, history = [] } = body
  const { currentPage, currentDeal, currentUser } = context ?? {}

  const role = session.user.role

  // Build page context hint
  const pageHint = currentDeal
    ? `\nAktuální OP: ${currentDeal.kod} [ID:${currentDeal.id}] — ${currentDeal.predmet ?? '(bez názvu)'}, stav: ${currentDeal.stav}, klient: ${currentDeal.client?.jmeno ?? '?'}`
    : ''

  // ── System prompt (static → will be cached by Anthropic) ─────────────────
  const systemPrompt = `Jsi Dáša, obchodní asistentka v CRM systému Felucia pro HVAC firmy.

CHARAKTER:
- Mluvíš výhradně v ženském rodě: udělala jsem, našla jsem, připravila jsem
- Krátké věty, fakta a čísla
- Nikdy se neomlouváš, nikdy nezačínáš "Jako AI..."
- Emoji max 1 na zprávu
- Když nevíš → "Tohle nemám." Nikdy neodhaduj data která nemáš

UŽIVATEL: ${currentUser?.jmeno ?? session.user.jmeno}, role: ${role}, org: ${org?.nazev ?? orgId}
DATUM: ${now.toLocaleDateString('cs-CZ')} (${['neděle','pondělí','úterý','středa','čtvrtek','pátek','sobota'][now.getDay()]})
STRÁNKA: ${currentPage ?? '?'}${pageHint}

NÁSTROJE — kdy je použít:
- search_deals: vždy když potřebuješ ID dealu, nebo info o konkrétním OP
- get_deal: detail OP vč. nabídek a aktivit
- search_clients: hledání klientů
- search_products: katalog produktů před tvorbou nabídky
- get_briefing: přehled úkolů/aktivit — použij okamžitě pro "co mám", "briefing", "tento týden"
- create_quote: CN k OP — proveď BEZ ptaní kdykoliv jsou produkty a ceny jasné
- create_deal: nový OP — ZEPTEJ SE JEDNOU "Mám vytvořit?" před provedením
- create_client: nový klient — ZEPTEJ SE JEDNOU "Mám vytvořit?" před provedením
- add_activity: aktivita k OP — proveď bez ptaní
- change_deal_status: změna stavu — proveď bez ptaní

BEZPEČNOSTNÍ OMEZENÍ:
- Role TECHNIK: nikdy nezobrazuj ceny, nemůžeš vytvářet nabídky ani OP
- Nikdy nesmažeš data (žádný delete nástroj neexistuje)
- Nikdy neodesíláš emaily bez potvrzení

FORMÁT ODPOVĚDÍ:
- Markdown, stručně
- Po create_quote zobraz tabulku: Položka | Množ. | Cena/ks | Celkem + celková cena
- Pro briefing: 3 sekce s počty
- Navigační odkaz: [→ Otevřít OP](/deals/UUID)
- Rychlé odpovědi (quickReplies): max 3, max 4 slova, přidej jen kde dávají smysl

FORMÁT VÝSTUPU — VŽDY JSON:
{
  "message": "markdown text pro uživatele",
  "quickReplies": ["možnost 1", "možnost 2"]
}
Pokud nejsou quickReplies → prázdné pole [].
NIKDY nevracej plain text — vždy JSON objekt.`

  // ── Haiku for simple queries, Sonnet for actions ──────────────────────────
  const msgLower = message.toLowerCase()
  const needsAction = /vytvoř|založ|přidej|udělej|vlož|sestav|nový|nová|nové|změň|nastav|přesuň|uprav/.test(msgLower)
  const model = needsAction ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001'

  // ── Build messages ────────────────────────────────────────────────────────
  interface ApiMessage {
    role: 'user' | 'assistant'
    content: string | ApiContentBlock[]
  }
  interface ApiContentBlock {
    type: string
    [key: string]: unknown
  }

  const messages: ApiMessage[] = [
    ...history.slice(-8).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message },
  ]

  // ── Agentic loop ──────────────────────────────────────────────────────────
  const MAX_ITERATIONS = 6
  let iterations = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCacheReadTokens = 0
  let totalToolCalls = 0
  let navigateTo: string | undefined

  try {
    while (iterations < MAX_ITERATIONS) {
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'prompt-caching-2024-07-31',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          system: [
            {
              type: 'text',
              text: systemPrompt,
              cache_control: { type: 'ephemeral' }, // prompt caching
            },
          ],
          tools: TOOLS,
          messages,
        }),
      })

      if (!anthropicRes.ok) {
        const err = await anthropicRes.text()
        console.error('[dasa] Anthropic API error:', err)
        return NextResponse.json({ error: 'AI service error' }, { status: 502 })
      }

      const data = await anthropicRes.json()

      // Accumulate token usage
      const usage = data.usage ?? {}
      totalInputTokens += usage.input_tokens ?? 0
      totalOutputTokens += usage.output_tokens ?? 0
      totalCacheReadTokens += usage.cache_read_input_tokens ?? 0

      const stopReason: string = data.stop_reason ?? 'end_turn'
      const content: ApiContentBlock[] = data.content ?? []

      if (stopReason === 'end_turn') {
        // Final response — parse JSON from Claude
        const textBlock = content.find(b => b.type === 'text')
        const rawText = String(textBlock?.text ?? '')

        let responseMessage = rawText
        let quickReplies: string[] = []

        const stripped = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
        const jsonStr = stripped.startsWith('{') ? stripped : (stripped.match(/\{[\s\S]*\}/) ?? [null])[0]
        if (jsonStr) {
          try {
            const parsed = JSON.parse(jsonStr)
            if (parsed.message !== undefined) {
              responseMessage = String(parsed.message)
              quickReplies = Array.isArray(parsed.quickReplies) ? parsed.quickReplies.slice(0, 3) : []
            }
          } catch { /* plain text fallback */ }
        }

        // Save usage log + update credits
        const credits = calcCredits(totalInputTokens, totalOutputTokens, totalCacheReadTokens)
        await Promise.all([
          db.aiUsageLog.create({
            data: {
              orgId, userId: session.user.id,
              inputTokens: totalInputTokens, outputTokens: totalOutputTokens,
              cacheReadTokens: totalCacheReadTokens,
              toolCalls: totalToolCalls, credits, model,
            },
          }),
          db.organization.update({
            where: { id: orgId },
            data: {
              aiTokensUsed: { increment: 1 },
              aiCreditsUsed: { increment: credits },
            },
          }),
        ])

        const newCreditsUsed = (org?.aiCreditsUsed ?? 0) + credits

        return NextResponse.json({
          message: responseMessage,
          quickReplies,
          navigateTo,
          creditsUsed: newCreditsUsed,
          creditsLimit: creditsLimit === Infinity ? null : creditsLimit,
          // legacy
          tokensUsed: (org?.aiTokensUsed ?? 0) + 1,
          tokenLimit: planLimits.aiTokensPerMonth === Infinity ? null : planLimits.aiTokensPerMonth,
        })
      }

      if (stopReason === 'tool_use') {
        // Add assistant message with tool_use blocks
        messages.push({ role: 'assistant', content })

        // Execute all tool calls in parallel
        const toolUseBlocks = content.filter(b => b.type === 'tool_use')
        totalToolCalls += toolUseBlocks.length

        const toolResults = await Promise.all(
          toolUseBlocks.map(async (tu) => {
            const toolResult = await executeTool(
              String(tu.name),
              (tu.input ?? {}) as Record<string, unknown>,
              { id: session.user.id, orgId, role, jmeno: session.user.jmeno }
            )
            if (toolResult.navigateTo) navigateTo = toolResult.navigateTo
            return {
              type: 'tool_result',
              tool_use_id: tu.id,
              content: toolResult.result,
            }
          })
        )

        messages.push({ role: 'user', content: toolResults as ApiContentBlock[] })
        iterations++
        continue
      }

      // Unexpected stop reason
      break
    }

    // Loop exhausted without end_turn
    return NextResponse.json({ message: 'Omlouvám se, nepodařilo se dokončit odpověď.', quickReplies: [], navigateTo })
  } catch (err) {
    console.error('[dasa] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
