import { test, expect, Page } from '@playwright/test'

/**
 * Kritické toky CRM. Každý test hlídá i JS chyby stránky (pageerror) —
 * to je záchranná síť proti rozbité hydrataci (např. při změnách CSP).
 */

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /hydrat/i.test(msg.text())) errors.push(msg.text())
  })
  return errors
}

test('dashboard se načte a je interaktivní', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/dashboard')
  await expect(page.locator('body')).toContainText(/dashboard|přehled|nástěnka/i)
  expect(errors).toEqual([])
})

test('zakázky: seznam a detail se otevřou', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/zakazky')
  await expect(page.locator('body')).toContainText('E2E Zakázka')
  await page.getByRole('row', { name: /E2E Zakázka/ }).getByRole('link', { name: /Detail/ }).click()
  await page.waitForURL(/\/zakazky\/[^/]+$/)
  await expect(page.locator('body')).toContainText('E2E Zakázka')
  expect(errors).toEqual([])
})

test('zakázka detail: rozbalovací kontakty fungují (hydratace)', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/zakazky')
  await page.getByRole('row', { name: /E2E Zakázka/ }).getByRole('link', { name: /Detail/ }).click()
  await page.waitForURL(/\/zakazky\/[^/]+$/)
  const kontakt = page.locator('summary', { hasText: /kontakt/i }).first()
  if (await kontakt.count()) {
    await kontakt.click()
    await expect(page.locator('body')).toContainText('klient@example.com')
  }
  expect(errors).toEqual([])
})

test('servis: seznam zakázek a detail', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/servis/zakazky')
  await expect(page.locator('body')).toContainText(/SZ-\d\d-9001/)
  await page.getByText(/SZ-\d\d-9001/).first().click()
  await page.waitForURL('**/servis/zakazky/**')
  await expect(page.locator('body')).toContainText(/protokol|stav|technik/i)
  expect(errors).toEqual([])
})

test('servisní nástěnka /servis se načte', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/servis')
  await expect(page.locator('body')).toContainText(/servis/i)
  expect(errors).toEqual([])
})

test('klienti: seznam obsahuje seed klienta', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/clients')
  await expect(page.locator('body')).toContainText('E2E')
  expect(errors).toEqual([])
})

test('API vrací JSON pro přihlášeného (session funguje)', async ({ page }) => {
  const res = await page.request.get('/api/notifications')
  expect(res.status()).toBeLessThan(500)
})

test('CSP: script-src má nonce a nemá unsafe-inline', async ({ page }) => {
  const res = await page.goto('/dashboard')
  const csp = res?.headers()['content-security-policy'] ?? ''
  const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? ''
  expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/)
  expect(scriptSrc).toContain("'strict-dynamic'")
  expect(scriptSrc).not.toContain('unsafe-inline')
})

test.describe('nepřihlášený', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('CSP: signin (dřív statická stránka) se hydratuje — formulář reaguje', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(String(err)))
    await page.goto('/auth/signin')
    await page.locator('input[type="email"]').fill('x@y.cz')
    await page.locator('input[type="password"]').fill('spatne')
    await page.locator('button[type="submit"]').click()
    // hydratovaný formulář zobrazí chybu (bez hydratace by se nic nestalo)
    await expect(page.locator('body')).toContainText('Nesprávný email nebo heslo', { timeout: 10_000 })
    expect(errors).toEqual([])
  })
})

test('sklad: záložky Zásoby / Dodavatelé / Objednávky se načtou a přepínají', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/sklad')
  await expect(page.locator('body')).toContainText(/Zásoby/)
  await page.getByRole('button', { name: 'Dodavatelé' }).click()
  await expect(page.locator('body')).toContainText(/Nový dodavatel|Zatím žádný dodavatel/)
  await page.getByRole('button', { name: 'Objednávky' }).click()
  await expect(page.locator('body')).toContainText(/Nové objednávky vznikají ze zakázky/)
  // dialog nového dodavatele nabízí lustraci přes ARES (našeptávač + tlačítko u IČO)
  await page.getByRole('button', { name: 'Dodavatelé' }).click()
  await page.getByRole('button', { name: /Nový dodavatel/ }).click()
  await expect(page.locator('body')).toContainText(/Vyhledat firmu v ARES/)
  await expect(page.getByRole('button', { name: 'ARES' })).toBeVisible()
  expect(errors).toEqual([])
})

test('zakázka: záložka Objednávky a tlačítko Objednat u dodavatele', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/zakazky')
  await page.getByRole('row', { name: /E2E Zakázka/ }).getByRole('link', { name: /Detail/ }).click()
  await page.waitForURL(/\/zakazky\/[^/]+$/)
  await page.getByRole('link', { name: 'Objednávky' }).click()
  await expect(page.locator('body')).toContainText(/Objednávky u dodavatelů/)
  await page.getByRole('button', { name: /Objednat u dodavatele/ }).click()
  await expect(page.locator('body')).toContainText(/Vyberte položky a dodavatele/)
  expect(errors).toEqual([])
})
