/** Slugy, které nesmí být tenant subdoménou (kolize s infrastrukturou / marketingem) */
export const FORBIDDEN_SLUGS = ['www', 'app', 'api', 'admin', 'mail', 'mail2', 'smtp', 'imap', 'felucia', 'test', 'demo', 'staging', 'crm', 'support', 'help', 'status', 'login', 'auth', 'static', 'cdn', 'ns1', 'ns2']

/** Normalizace názvu na slug: lowercase, bez diakritiky, jen [a-z0-9-], max 30 znaků */
export function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30)
}
