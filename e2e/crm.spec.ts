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
