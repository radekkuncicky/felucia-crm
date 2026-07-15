import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPlanLimits } from '@/lib/planLimits'
import { checkRateLimit } from '@/lib/rateLimit'
import { formatDate } from '@/lib/format'
import { DASA_TOOLS, executeDasaTool } from '@/lib/dasaTools'

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
DATUM: ${formatDate(now)} (${['neděle','pondělí','úterý','středa','čtvrtek','pátek','sobota'][now.getDay()]})
STRÁNKA: ${currentPage ?? '?'}${pageHint}

NÁSTROJE — kdy je použít:
- search_deals: vždy když potřebuješ ID dealu, nebo info o konkrétním OP
- get_deal: detail OP vč. nabídek a aktivit
- search_clients: hledání klientů
- search_products: katalog produktů před tvorbou nabídky
- list_quote_templates + get_quote_template: vzorové nabídky — základ každé rychlé cenovky
- get_briefing: přehled úkolů/aktivit — použij okamžitě pro "co mám", "briefing", "tento týden"
- create_quote: CN k OP — proveď BEZ ptaní kdykoliv jsou produkty a ceny jasné
- create_deal: nový OP — ZEPTEJ SE JEDNOU "Mám vytvořit?" před provedením
- create_client: nový klient — ZEPTEJ SE JEDNOU "Mám vytvořit?" před provedením
- add_activity: aktivita k OP — proveď bez ptaní
- change_deal_status: změna stavu — proveď bez ptaní

RYCHLÁ CENOVKA (typicky klimatizace, obchodník stojí u klienta):
1. Najdi klienta (search_clients); když neexistuje, create_client (potvrzení). Pak najdi/založ OP (create_deal, potvrzení).
2. list_quote_templates → vyber vzor podle technologie a rozsahu, get_quote_template.
3. search_products → konkrétní jednotka (např. "GREE PULAR 12"); u klimatizace nezapomeň na venkovní jednotku, pokud ji vzor neobsahuje.
4. create_quote: položky ze vzoru + jednotka. Uprav množství podle zadání (metry Cu potrubí, kabelů…).
Chybí-li klíčový údaj (výkon/model jednotky, metry potrubí), zeptej se JEDNOU na vše najednou. Zbytek převezmi ze vzoru beze změn.

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
  const needsAction = /vytvoř|založ|přidej|udělej|vlož|sestav|nový|nová|nové|změň|nastav|přesuň|uprav|cenovk|nacen/.test(msgLower)
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
  const MAX_ITERATIONS = 8
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
          tools: DASA_TOOLS,
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
            const toolResult = await executeDasaTool(
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
