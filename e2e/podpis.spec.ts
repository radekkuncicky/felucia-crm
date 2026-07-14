import { test, expect, Page } from '@playwright/test'

/**
 * Veřejná podpisová stránka /podpis/[token] — musí fungovat BEZ přihlášení
 * (klient nemá účet). Plný podpisový flow pokrývá integrační test
 * tests/sod-podpis-flow.test.ts; tady hlídáme routing, hydrataci a to,
 * že stránka nevyžaduje session.
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

test('neplatný token: stránka se načte bez přihlášení a ukáže srozumitelnou chybu', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/podpis/neplatny-token-1234567890abcdef')
  // nesmí přesměrovat na login
  await expect(page).toHaveURL(/\/podpis\//)
  await expect(page.locator('body')).toContainText('Odkaz už není platný')
  await expect(page.locator('body')).toContainText('Zabezpečený podpis')
  expect(errors).toEqual([])
})

test('veřejné API podpisu nevyžaduje session a nevydá obsah', async ({ request }) => {
  const res = await request.get('/api/public/podpis/neplatny-token-1234567890abcdef')
  expect(res.status()).toBe(404)
  const data = await res.json()
  expect(data.faze).toBe('NEPLATNY')
  expect(JSON.stringify(data)).not.toContain('contractHtml')
})
