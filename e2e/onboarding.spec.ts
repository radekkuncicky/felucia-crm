import { test, expect, Page } from '@playwright/test'

/**
 * Generálka onboardingu: čistá firma od registrace přes průvodce po první OP.
 * Hlídá, že nový zákazník projde bez JS chyb, dostane výchozí šablony
 * a narazí na limity plánu srozumitelně (ne rozbitou stránkou).
 */

test.use({ storageState: { cookies: [], origins: [] } })

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /hydrat/i.test(msg.text())) errors.push(msg.text())
  })
  return errors
}

test('nová firma: registrace → onboarding → šablony → limit pozvánky → první OP', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = trackErrors(page)
  const run = Date.now()
  const firma = `Smoke Klima ${run}`
  const email = `smoke-${run}@example.cz`
  const heslo = 'Smoke-Heslo-123'

  // Produkční build po registraci přesměruje na https://{slug}.felucia.io/onboarding —
  // v izolovaném prostředí to zachytíme a pokračujeme na localhostu.
  let redirectedTo = ''
  await page.route(/^https:\/\/[^/]+\/onboarding/, (route) => {
    redirectedTo = route.request().url()
    return route.abort()
  })

  // ── 1. Registrace (3 kroky) ────────────────────────────────────────────────
  await page.goto('/auth/register')
  await page.getByPlaceholder('ACME s.r.o.').fill(firma)
  // ověření subdomény je asynchronní — Pokračovat projde, až doběhne
  await expect(async () => {
    await page.getByRole('button', { name: 'Pokračovat →' }).click()
    await expect(page.getByPlaceholder('Novák')).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: 15_000 })

  await page.getByPlaceholder('Jan', { exact: true }).fill('Samuel')
  await page.getByPlaceholder('Novák').fill('Smoke')
  await page.getByPlaceholder('jan@firma.cz').fill(email)
  await page.locator('input[type="password"]').nth(0).fill(heslo)
  await page.locator('input[type="password"]').nth(1).fill(heslo)
  await page.getByRole('button', { name: 'Pokračovat →' }).click()

  await expect(page.locator('body')).toContainText('Shrnutí')
  await page.locator('input[type="checkbox"]').check()
  await page.locator('button[type="submit"]').click()

  await expect.poll(() => redirectedTo, { timeout: 20_000 }).toMatch(/\/onboarding$/)
  const slug = new URL(redirectedTo).hostname.split('.')[0]
  expect(firma.toLowerCase().replace(/ /g, '-')).toContain(slug.slice(0, 10))

  // ── 2. Průvodce onboardingem se načte a jde přeskočit ──────────────────────
  await page.goto('/onboarding')
  await expect(page.locator('body')).toContainText('Řekněte nám o vaší firmě')
  await page.getByRole('button', { name: 'Přeskočit' }).first().click()
  await expect(page.locator('body')).toContainText('Jak vás budou klienti znát')

  // ── 3. Výchozí šablony nové firmy ──────────────────────────────────────────
  await page.goto('/quote-templates')
  await expect(page.locator('body')).toContainText('Základní nabídka')
  await page.goto('/settings/contract-templates')
  await expect(page.locator('body')).toContainText('Smlouva o dílo')

  // ── 4. Pozvánka kolegy na STARTERu narazí na limit — srozumitelně ──────────
  const invite = await page.request.post('/api/onboarding/invite', {
    data: { emails: [`kolega-${run}@example.cz`] },
  })
  expect(invite.status()).toBeLessThan(500)
  const inviteJson = await invite.json()
  expect(JSON.stringify(inviteJson)).toContain('Limit uživatelů')

  // ── 5. První klient + OP a jeho detail ─────────────────────────────────────
  const client = await page.request.post('/api/clients', {
    data: { jmeno: 'Petra', prijmeni: `Prvni${run}`, telefon: `+420 7${String(run).slice(-8)}` },
  })
  expect(client.status()).toBeLessThan(300)
  const { id: clientId } = await client.json()

  const deal = await page.request.post('/api/deals', {
    data: { clientId, technologie: 'KLIMA', predmet: 'Klimatizace do obýváku' },
  })
  expect(deal.status()).toBeLessThan(300)
  const { id: dealId } = await deal.json()

  await page.goto(`/deals/${dealId}`)
  await expect(page.locator('body')).toContainText('Klimatizace do obýváku')
  await expect(page.locator('body')).toContainText(`Prvni${run}`)

  // ── 6. Nástěnka nové firmy ─────────────────────────────────────────────────
  await page.goto('/dashboard')
  await expect(page.locator('body')).toContainText(/Co mám dělat/)

  expect(errors).toEqual([])
})
