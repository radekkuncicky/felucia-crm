import 'dotenv/config'

// Přihlašovací údaje e2e admina — z .env (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD),
// nikdy natvrdo v kódu. Účet seeduje e2e/seed.ts jen do nanto_crm_test.
export const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'e2e-admin@felucia.io'

const password = process.env.E2E_ADMIN_PASSWORD
if (!password) throw new Error('e2e: chybí E2E_ADMIN_PASSWORD v .env')
export const E2E_ADMIN_PASSWORD: string = password
