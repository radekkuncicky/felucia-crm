import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // next/image se nepoužívá; /_next/image optimizer je neautentizovaný endpoint
  // s historií CVE (viz docs/SECURITY_AUDIT_2026-09.md SEC-13) — vypnuto.
  images: { unoptimized: true },
  experimental: {
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Content-Security-Policy nastavuje middleware.ts (per-request nonce)
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
      {
        source: '/api/auth/mobile/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type' },
        ],
      },
      // Pozor: blanketová CORS hlavička pro /api/:path* se NESMÍ přidávat —
      // sčítá se (nenahrazuje) s vlastní CORS logikou v app/api/public/*
      // (duplicitní Access-Control-Allow-Origin => prohlížeč odpověď zahodí).
      // Cross-origin veřejné endpointy (leady z webu apod.) si CORS řeší samy.
    ]
  },
}

export default withSentryConfig(nextConfig, {
  // upload source map jen když je nastaven SENTRY_AUTH_TOKEN, jinak tiše přeskočí
  silent: true,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
})
