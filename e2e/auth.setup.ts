import { test as setup, expect } from '@playwright/test'
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from './credentials'

setup('přihlášení admina', async ({ page }) => {
  await page.goto('/auth/signin')
  await page.locator('input[type="email"]').fill(E2E_ADMIN_EMAIL)
  await page.locator('input[type="password"]').fill(E2E_ADMIN_PASSWORD)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
  await expect(page.locator('body')).not.toContainText('Nesprávný email nebo heslo')
  await page.context().storageState({ path: 'e2e/.auth/admin.json' })
})
