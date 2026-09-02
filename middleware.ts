import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isRoleName, isTechnikView, ROLE_PRESETS } from '@/lib/permissions'

// Stránky obchodní části — technický pohled je nevidí (menu je nenabízí, tohle chytá přímé URL)
const OBCHOD_PREFIXES = ['/deals', '/clients', '/leady', '/products', '/quote-templates', '/quotes', '/activities', '/sod', '/cenovka', '/analytics', '/documents']

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'

const MAIN_DOMAINS = [
  ROOT_DOMAIN,
  `www.${ROOT_DOMAIN}`,
  'crm.workspace-felucia.io',
  'localhost:3000',
  'localhost',
]

// CSP s per-request nonce místo script-src 'unsafe-inline'. Nonce se předá
// Nextu přes request header Content-Security-Policy (odtud si ho vezme pro
// své inline bootstrap skripty) a do layoutu přes x-nonce. 'strict-dynamic'
// povolí skripty, které nonce'nuté skripty samy vloží (chunky, Stripe.js).
function buildCsp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com https://fonts.googleapis.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://api.anthropic.com https://api.stripe.com https://*.sentry.io wss:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  ].join('; ')
}

function makeNonce() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...Array.from(bytes)))
}

// NextResponse.next() s nonce v request headerech + CSP na odpovědi
function nextWithCsp(req: NextRequest, extraRequestHeaders?: Headers) {
  const nonce = makeNonce()
  const csp = buildCsp(nonce)
  const requestHeaders = extraRequestHeaders ?? new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)
  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set('Content-Security-Policy', csp)
  return res
}

export async function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') || ''
  const url = req.nextUrl.clone()

  // ── Static uploads auth ───────────────────────────────────────────────────
  // Fotky zakázek (/uploads/zakazky/) jsou veřejné — cesty jsou obscurní
  // (CUID ID + timestamp), takže auth není potřeba a Image v RN to zvládne.
  // Loga org a avatary stále vyžadují přihlášení.
  if (url.pathname.startsWith('/uploads/')) {
    if (!url.pathname.startsWith('/uploads/zakazky/') && !url.pathname.startsWith('/uploads/predavaky/')) {
      const uploadToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
      if (!uploadToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
  }

  // ── Subdomain detection ───────────────────────────────────────────────────
  const isSubdomain =
    hostname.endsWith(`.${ROOT_DOMAIN}`) && !MAIN_DOMAINS.includes(hostname)

  if (isSubdomain) {
    const slug = hostname.split('.')[0]
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-tenant-slug', slug)

    if (url.pathname === '/') {
      url.pathname = '/auth/signin'
      return NextResponse.redirect(url)
    }

    return nextWithCsp(req, requestHeaders)
  }

  // ── Main domain ───────────────────────────────────────────────────────────
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  // ── Maintenance mode ──────────────────────────────────────────────────────
  const isMaintenancePage = url.pathname === '/maintenance'
  const isSuperAdminRoute = url.pathname.startsWith('/superadmin')
  const isAuthRoute = url.pathname.startsWith('/auth') || url.pathname.startsWith('/login')
  const isApiRoute = url.pathname.startsWith('/api')

  if (
    !isMaintenancePage &&
    !isSuperAdminRoute &&
    !isAuthRoute &&
    !isApiRoute &&
    process.env.MAINTENANCE_MODE === 'true'
  ) {
    url.pathname = '/maintenance'
    return NextResponse.redirect(url)
  }

  // ── Super admin protection ────────────────────────────────────────────────
  if (isSuperAdminRoute) {
    if (!token) {
      url.pathname = '/auth/signin'
      return NextResponse.redirect(url)
    }
    if (!token.isSuperAdmin) {
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    return nextWithCsp(req)
  }

  const isAuthPage =
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/forgot-password') ||
    url.pathname.startsWith('/reset-password') ||
    url.pathname.startsWith('/magic-link')

  // Podmnožina isAuthPage, ze které se přihlášený uživatel přesměruje na /dashboard.
  // Reset/obnova hesla musí zůstat dostupná i se stále platnou (např. starou) session —
  // jinak middleware odkopne uživatele zpátky na dashboard dřív, než stihne heslo změnit.
  const isLoginOnlyPage =
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/login')

  const isPublicPage =
    url.pathname === '/' ||
    url.pathname.startsWith('/api/webhooks') ||
    url.pathname.startsWith('/zarizeni') ||
    url.pathname.startsWith('/podpis') ||
    url.pathname.startsWith('/nabidka') ||
    url.pathname.startsWith('/demo') ||
    url.pathname.startsWith('/terms') ||
    url.pathname.startsWith('/privacy')

  const isOnboardingPage = url.pathname.startsWith('/onboarding')

  if (!token && !isAuthPage && !isPublicPage && !isApiRoute && !isOnboardingPage) {
    url.pathname = '/auth/signin'
    return NextResponse.redirect(url)
  }

  if (!token && isOnboardingPage) {
    url.pathname = '/auth/signin'
    return NextResponse.redirect(url)
  }

  if (token && !token.isDemo && isLoginOnlyPage) {
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ── Demo session write protection ────────────────────────────────────────
  if (
    token?.isDemo &&
    url.pathname.startsWith('/api') &&
    !url.pathname.startsWith('/api/auth') &&
    ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)
  ) {
    return NextResponse.json({ ok: true, _demo: true }, { status: 200 })
  }

  // ── Technický pohled (bez obchodu) — hrubý filtr obchodních stránek ─────────
  // Jemná kontrola (rozsah zakázek, nákupky, sklad, servis…) je v každé stránce/API
  // přes getPerms(); tady jen přesměrujeme technika mimo obchodní část UI.
  if (token && !isApiRoute && !token.isSuperAdmin) {
    const perms = token.perms ?? ROLE_PRESETS[isRoleName(token.role) ? token.role : 'TECHNIK']
    if (isTechnikView(perms)) {
      const isObchodPage = OBCHOD_PREFIXES.some(p => url.pathname === p || url.pathname.startsWith(p + '/'))
      if (isObchodPage) {
        url.pathname = '/zakazky'
        url.search = ''
        return NextResponse.redirect(url)
      }
    }
  }

  return nextWithCsp(req)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public|robots.txt|sitemap.xml).*)'],
}
