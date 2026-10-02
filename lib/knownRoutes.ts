// První segmenty cest, které v aplikaci existují (routy v app/ + soubory z public/).
// Middleware podle toho rozliší „nepřihlášený jde do CRM“ (→ přihlášení) od
// „adresa neexistuje“ (→ 404, ne přesměrování na login — vyhledávače a AI crawlery
// by jinak u každého překlepu nebo starého odkazu viděly přihlašovací formulář).
// Fail-closed: chybějící položka znamená jen 404 pro nepřihlášené, nikdy průchod bez auth.
// Shodu se stromem app/ hlídá tests/known-routes.test.ts.
export const KNOWN_TOP_SEGMENTS = new Set([
  // app/(dashboard)
  'activities', 'analytics', 'calendar', 'cenovka', 'clients', 'dashboard', 'deals', 'documents',
  'leady', 'predavaky', 'products', 'quote-templates', 'quotes', 'servis', 'settings', 'sklad', 'sod', 'zakazky',
  // app/(auth) a ostatní
  'api', 'auth', 'demo', 'forgot-password', 'login', 'magic-link', 'maintenance', 'nabidka', 'onboarding',
  'podpis', 'privacy', 'reset-password', 'superadmin', 'support', 'terms', 'zarizeni',
  // public/
  'templates', 'uploads', 'marketing',
  // app/.well-known (katalog pro AI agenty)
  '.well-known',
])

export function isKnownRoute(pathname: string): boolean {
  const first = pathname.split('/')[1] ?? ''
  return first === '' || KNOWN_TOP_SEGMENTS.has(first)
}
