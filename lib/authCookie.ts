/**
 * Session cookie sdílená mezi felucia.io a {slug}.felucia.io — přihlášení na
 * hlavní doméně (registrace, odkaz z e-mailu) platí i na subdoméně firmy a naopak.
 * Bez Node závislostí: používá ji i middleware (edge).
 *
 * Doména se nastaví jen když NEXTAUTH_URL je přímo root doména (prod). Lokálně
 * a v E2E (localhost) zůstává cookie vázaná na host.
 *
 * Název je nový (ne výchozí next-auth.session-token): staré host-only cookie se
 * stejným jménem by se na subdoménách pletly s novou doménovou. Po nasazení se
 * proto každý na webu jednou přihlásí znovu. Mobilní appky to neovlivní.
 */
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'

function authHost(): string {
  try { return new URL(process.env.NEXTAUTH_URL ?? '').hostname } catch { return '' }
}

export const SECURE_COOKIES = (process.env.NEXTAUTH_URL ?? '').startsWith('https://')
export const SESSION_COOKIE_DOMAIN = authHost() === ROOT_DOMAIN ? `.${ROOT_DOMAIN}` : undefined
export const SESSION_COOKIE_NAME = `${SECURE_COOKIES ? '__Secure-' : ''}felucia.session-token`

/** Adresa CRM dané firmy — sem vedou odkazy z pozvánek, resetu hesla a uvítání */
export function orgBaseUrl(slug: string | null | undefined): string {
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000'
  if (!slug) return process.env.NEXTAUTH_URL ?? `https://${ROOT_DOMAIN}`
  return `https://${slug}.${ROOT_DOMAIN}`
}
