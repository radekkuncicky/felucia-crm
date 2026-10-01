import { test, expect } from '@playwright/test'

// DOČASNÝ test náhledu nové homepage (část 2/4): bez vodorovného scrollu na 360 a 1280 px.
const SHOTS = process.env.HP_SHOTS_DIR

for (const width of [360, 1280]) {
  test(`homepage-preview bez vodorovného scrollu (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/homepage-preview')
    await expect(page.locator('h1')).toContainText('Design systém')
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth, `scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`).toBeLessThanOrEqual(clientWidth)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/preview-${width}.png`, fullPage: true })
  })
}

test('hero: šipky přepínají fáze, reduced motion ukáže kompletní zakázku', async ({ page, browser }) => {
  await page.goto('/homepage-preview')
  const tab = page.getByRole('tab', { name: 'Obchod' })
  await tab.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Smlouva' })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('End')
  await expect(page.getByRole('tab', { name: 'Servis' })).toHaveAttribute('aria-selected', 'true')

  const ctx = await browser.newContext({ reducedMotion: 'reduce', storageState: 'e2e/.auth/admin.json' })
  const p2 = await ctx.newPage()
  await p2.goto('/homepage-preview')
  await expect(p2.getByText('Kompletní zakázka')).toBeVisible()
  await expect(p2.getByRole('button', { name: /ukázku/ })).toHaveCount(0)
  await ctx.close()
})
