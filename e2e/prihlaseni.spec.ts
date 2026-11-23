import { test, expect } from '@playwright/test'

/**
 * Cesta nového uživatele v prohlížeči: admin pozve obchodníka → pozvaný otevře
 * odkaz → nastaví heslo → je rovnou přihlášený na nástěnce. Pak odhlášení a
 * přihlášení e-mailem s velkými písmeny. Audit přihlášení 2026-11-23.
 */
const RUN = `e2e-pozv-${Date.now()}`

test('pozvánka → nastavení hesla → auto-login → login s velkými písmeny', async ({ page, browser }) => {
  // admin (storageState) založí obchodníka bez hesla = pozvánka
  const res = await page.request.post('/api/settings/users', {
    data: { jmeno: 'Pozvaný Obchodník', email: ` ${RUN}@Example.CZ `, role: 'OBCHODNIK' },
  })
  expect(res.status()).toBe(201)
  const data = await res.json()
  expect(data.email).toBe(`${RUN}@example.cz`)
  expect(data.inviteUrl).toContain('/reset-password?token=')

  // admin vidí stav „Čeká na přijetí“
  await page.goto('/settings/users')
  await expect(page.locator('body')).toContainText('Čeká na přijetí')

  // pozvaný — čistý prohlížeč bez session; odkaz vede na subdoménu firmy, tady jen cesta
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const p = await ctx.newPage()
  const errors: string[] = []
  p.on('pageerror', e => errors.push(String(e)))
  const u = new URL(data.inviteUrl)
  await p.goto(u.pathname + u.search)
  await expect(p.locator('body')).toContainText('Vítejte', { timeout: 10_000 })
  await expect(p.locator('body')).toContainText(`${RUN}@example.cz`)

  const pw = p.locator('input[autocomplete="new-password"]')
  await pw.nth(0).fill('PozvanyHeslo123')
  await pw.nth(1).fill('PozvanyHeslo123')
  await p.locator('button[type="submit"]').click()
  await p.waitForURL('**/dashboard**', { timeout: 15_000 })

  // odkaz je spotřebovaný
  await p.goto(u.pathname + u.search)
  await expect(p.locator('body')).toContainText('Odkaz už byl použit', { timeout: 10_000 })

  // odhlásit (smazat cookies) a přihlásit se e-mailem s velkými písmeny a mezerou
  await ctx.clearCookies()
  await p.goto('/auth/signin')
  await p.locator('input[type="email"]').fill(`${RUN.toUpperCase()}@EXAMPLE.cz `)
  await p.locator('input[type="password"]').fill('PozvanyHeslo123')
  await p.locator('button[type="submit"]').click()
  await p.waitForURL('**/dashboard**', { timeout: 15_000 })
  expect(errors).toEqual([])
  await ctx.close()
})

test('nepřihlášený z hluboké odkazu se po přihlášení vrátí na původní stránku', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const p = await ctx.newPage()
  await p.goto('/settings/profile')
  await p.waitForURL(/\/auth\/signin\?callbackUrl=/, { timeout: 10_000 })
  expect(decodeURIComponent(p.url())).toContain('callbackUrl=/settings/profile')
  await ctx.close()
})

test('zapomenuté heslo: chybná adresa ukáže chybu, ne „odesláno“', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const p = await ctx.newPage()
  await p.goto('/forgot-password')
  await p.locator('input[type="email"]').fill('neplatna@adresa')
  await p.locator('button[type="submit"]').click()
  await expect(p.locator('[role="alert"]', { hasText: 'e-mail' })).toBeVisible({ timeout: 10_000 })
  await expect(p.locator('body')).not.toContainText('Pokud k adrese')
  await ctx.close()
})

test('zaniklá session: po 401 přesměrování na přihlášení s vysvětlením a návratem', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
  const p = await ctx.newPage()
  await p.goto('/settings/users')
  await expect(p.locator('body')).toContainText('Správa uživatelů')
  await p.waitForTimeout(500) // useSession načte stav „přihlášen“
  await ctx.clearCookies()
  await p.evaluate(() => fetch('/api/settings/users').catch(() => null))
  await p.waitForURL(/reason=expired/, { timeout: 10_000 })
  expect(decodeURIComponent(p.url())).toContain('callbackUrl=/settings/users')
  await expect(p.locator('body')).toContainText('Byli jste odhlášeni')
  await ctx.close()
})
