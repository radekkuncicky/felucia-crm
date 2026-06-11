import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // jen chyby, žádný performance tracing (šetří kvótu)
  tracesSampleRate: 0,
  sendDefaultPii: false,
})
