import { defineConfig } from '@playwright/test'

/**
 * E2E testy běží proti izolovanému prostředí (worktree + nanto_crm_test),
 * NIKDY proti prod serveru. Spouštění: ./scripts/e2e.sh
 * (postaví izolovaný build ve scratch adresáři, naseeduje DB a pustí testy).
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { storageState: 'e2e/.auth/admin.json' },
    },
  ],
})
