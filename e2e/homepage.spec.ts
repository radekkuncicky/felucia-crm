import { test, expect } from '@playwright/test'

// Nová homepage (část 3/4) pro nepřihlášeného návštěvníka.
test.use({ storageState: { cookies: [], origins: [] } })

const SHOTS = process.env.HP_SHOTS_DIR

for (const width of [360, 1280]) {
  test(`homepage bez vodorovného scrollu (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.locator('h1')).toHaveText('Co prodáte, to se namontuje. Co se použije, to se vyúčtuje.')
    // Rozbalit srovnání cen, ať se měří i tabulka
    await page.locator('#ceny summary').click()
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth, `scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`).toBeLessThanOrEqual(clientWidth)
    if (SHOTS) {
      await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach(el => el.setAttribute('data-revealed', '')))
      await page.screenshot({ path: `${SHOTS}/home-${width}.png`, fullPage: true })
    }
  })
}

test('jeden H1, nadpisy bez přeskočené úrovně, kotvy existují', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveCount(1)
  const urovne = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main h1, main h2, main h3, main h4'))
      .filter(h => !h.closest('[hidden]'))
      .map(h => Number(h.tagName[1])))
  for (let i = 1; i < urovne.length; i++) expect(urovne[i] - urovne[i - 1], `skok ${urovne[i - 1]} -> ${urovne[i]}`).toBeLessThanOrEqual(1)
  for (const id of ['jak-to-funguje', 'technici', 'servis', 'funkce', 'ceny', 'faq', 'ukazka']) {
    await expect(page.locator(`#${id}`), `#${id}`).toHaveCount(1)
  }
  const hrefs = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href')!))
  for (const h of hrefs.filter(h => h.startsWith('#'))) {
    if (h === '#obsah') continue
    expect(await page.locator(h).count(), `odkaz ${h} nikam nevede`).toBeGreaterThan(0)
  }
  for (const h of ['/auth/signin', '/terms', '/privacy', '/support', 'mailto:info@felucia.io', 'tel:+420724347986']) {
    expect(hrefs, h).toContain(h)
  }
  for (const h of ['/auth/signin', '/terms', '/privacy', '/support']) {
    const res = await page.request.get(h)
    expect(res.status(), h).toBe(200)
  }
})

test('průvodce: šipky, Home, End a odkaz #krok-servis', async ({ page }) => {
  await page.goto('/')
  await page.locator('#krok-obchod').focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('#krok-smlouva')).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('End')
  await expect(page.locator('#krok-servis')).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Home')
  await expect(page.locator('#krok-obchod')).toHaveAttribute('aria-selected', 'true')
  await page.goto('/#krok-predani')
  await expect(page.locator('#krok-predani')).toHaveAttribute('aria-selected', 'true')
})

test('reduced motion: hero bez smyčky, sekce bez náběhu', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', storageState: { cookies: [], origins: [] } })
  const page = await ctx.newPage()
  await page.goto('/')
  await expect(page.getByText('Kompletní zakázka')).toBeVisible()
  await expect(page.getByRole('button', { name: /^(Pozastavit|Spustit) ukázku$/ })).toHaveCount(0)
  await expect(page.locator('.mk-reveal-on')).toHaveCount(0)
  await ctx.close()
})

test('formulář posílá stejná data na /api/contact (bez skutečného odeslání)', async ({ page }) => {
  let body: Record<string, string> | null = null
  await page.route('**/api/contact', async route => {
    body = route.request().postDataJSON()
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
  })
  await page.goto('/#ukazka')
  await page.getByLabel('Jméno a příjmení *').fill('Test Testovací')
  await page.getByLabel('Název firmy *').fill('Test s.r.o.')
  await page.getByLabel('Email *').fill('test@example.cz')
  await page.getByLabel('Telefon (nepovinně)').fill('123')
  await page.locator('#ukazka button[type="submit"]').click()
  await expect(page.getByText('Žádost přijata!')).toBeVisible()
  expect(body).toEqual({
    jmeno: 'Test Testovací',
    email: 'test@example.cz',
    zprava: 'ŽÁDOST O UKÁZKU FELUCIA\n\nFirma: Test s.r.o.\nTelefon: 123\n\nMá zájem o 20minutovou ukázku Felucia a probrat zavedení pro svou firmu.',
  })
})

test('neexistující adresa vrací 404 (ne přihlášení), CRM adresa dál vede na přihlášení', async ({ page, request }) => {
  const res = await page.goto('/neexistujici-stranka')
  expect(res?.status()).toBe(404)
  await expect(page).toHaveURL(/\/neexistujici-stranka$/)
  await page.goto('/zakazky')
  await expect(page).toHaveURL(/\/auth\/signin/)
  const llmsFull = await request.get('/llms-full.txt', { maxRedirects: 0 })
  expect(llmsFull.status()).toBe(404)
})

test('katalog pro AI agenty (ARD) je platný JSON', async ({ request }) => {
  for (const p of ['/.well-known/ai-catalog.json', '/.well-known/ard.json']) {
    const res = await request.get(p, { maxRedirects: 0 })
    expect(res.status(), p).toBe(200)
    expect(res.headers()['content-type']).toContain('application/json')
    const json = await res.json()
    expect(json.specVersion).toBe('1.0')
    expect(json.entries[0].url).toMatch(/\/llms\.txt$/)
  }
})

test('text webu přednačítá písmo a má metricky sladěný fallback (CLS)', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('link[rel="preload"][href="/marketing/fonts/atkinson/latin-ext.woff2"]')).toHaveCount(1)
  const font = await page.evaluate(() => getComputedStyle(document.querySelector('.mk')!).fontFamily)
  expect(font).toContain('Atkinson Fallback')
})
