import { test as setup, expect } from '@playwright/test'

const ADMIN_EMAIL = 'e2e-admin@felucia.io'
const ADMIN_PASSWORD = 'e2e-Heslo-123'

setup('přihlášení admina', async ({ page }) => {
  await page.goto('/auth/signin')
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL)
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
  await expect(page.locator('body')).not.toContainText('Nesprávný email nebo heslo')
  await page.context().storageState({ path: 'e2e/.auth/admin.json' })
})
