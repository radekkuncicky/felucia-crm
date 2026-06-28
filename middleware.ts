import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'

const MAIN_DOMAINS = [
  ROOT_DOMAIN,
  `www.${ROOT_DOMAIN}`,
  'crm.workspace-felucia.io',
  'localhost:3000',
  'localhost',
]

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

    return NextResponse.next({
      request: { headers: requestHeaders },
    })
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
    return NextResponse.next()
  }

  const isAuthPage =
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/forgot-password') ||
    url.pathname.startsWith('/reset-password') ||
    url.pathname.startsWith('/magic-link')

  const isPublicPage =
    url.pathname === '/' ||
    url.pathname.startsWith('/api/webhooks') ||
    url.pathname.startsWith('/zarizeni') ||
    url.pathname.startsWith('/demo')

  const isOnboardingPage = url.pathname.startsWith('/onboarding')

  if (!token && !isAuthPage && !isPublicPage && !isApiRoute && !isOnboardingPage) {
    url.pathname = '/auth/signin'
    return NextResponse.redirect(url)
  }

  if (!token && isOnboardingPage) {
    url.pathname = '/auth/signin'
    return NextResponse.redirect(url)
  }

  if (token && !token.isDemo && isAuthPage) {
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

  // ── TECHNIK role restriction ──────────────────────────────────────────────
  if (token && token.role === 'TECHNIK') {
    const isTechnikAllowedPage =
      url.pathname.startsWith('/zakazky') ||
      url.pathname.startsWith('/api/zakazky') ||
      url.pathname.startsWith('/api/predavaky') ||
      url.pathname.startsWith('/api/auth') ||
      url.pathname.startsWith('/auth') ||
      url.pathname === '/dashboard'

    if (!isTechnikAllowedPage && !isApiRoute) {
      url.pathname = '/zakazky'
      return NextResponse.redirect(url)
    }

    if (isApiRoute && !isTechnikAllowedPage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public|robots.txt|sitemap.xml).*)'],
}
