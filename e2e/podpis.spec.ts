import { test, expect, Page } from '@playwright/test'
import { E2E_PODPIS_TOKEN, E2E_PODPIS_OTP } from './podpis-fixture'

/**
 * Veřejná podpisová stránka /podpis/[token] — musí fungovat BEZ přihlášení
 * (klient nemá účet). Plný podpisový flow pokrývá integrační test
 * tests/sod-podpis-flow.test.ts; tady hlídáme routing, hydrataci a to,
 * že stránka nevyžaduje session. Fixture (org/sod/relace/OTP) seeduje
 * e2e/seed.ts — tenhle soubor mluví jen s HTTP, žádné přímé DB dotazy
 * (Playwright běží proti $ROOT/.env, což je prod DB, ne nanto_crm_test).
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

// Nudge „podepiš na mobilu" (QR kód na stejný odkaz) — desktop only, CSS
// skryté na mobilu. Fixture (org/sod/relace/OTP) seeduje e2e/seed.ts.
test.describe('QR nudge na podepiš-na-mobilu', () => {
  test('desktop: nudge s QR kódem je vidět na obrazovce ověření', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/podpis/${E2E_PODPIS_TOKEN}`)
    const nudge = page.getByText('Pohodlnější podpis na mobilu')
    await expect(nudge).toBeVisible()
    await expect(page.locator('svg').first()).toBeVisible() // QR svg vykreslené
    await page.screenshot({ path: 'e2e/.results/qr-nudge-desktop.png' })

    // 🔍 zavření nudge ho schová a nevrátí zpět bez reloadu
    await page.getByLabel('Zavřít').click()
    await expect(nudge).toBeHidden()
  })

  test('mobil: nudge je v DOM, ale CSS skrytý (žádný QR na malé obrazovce)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/podpis/${E2E_PODPIS_TOKEN}`)
    await expect(page.getByText('Pohodlnější podpis na mobilu')).toBeHidden()
  })

  test('desktop: nudge zůstává i po ověření OTP, na obrazovce se smlouvou', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/podpis/${E2E_PODPIS_TOKEN}`)

    // OTP je předpočítaný v seedu — volání /otp by v env se živými SMS
    // credentials poslalo skutečnou SMS, tomu se test vyhýbá.
    const res = await page.request.post(`/api/public/podpis/${E2E_PODPIS_TOKEN}/overit`, { data: { kod: E2E_PODPIS_OTP } })
    expect(res.ok()).toBeTruthy()

    await page.reload()
    await expect(page.getByText('Totožnost ověřena')).toBeVisible()
    await expect(page.getByText('Pohodlnější podpis na mobilu')).toBeVisible()
    await page.screenshot({ path: 'e2e/.results/qr-nudge-desktop-smlouva.png' })
  })
})
