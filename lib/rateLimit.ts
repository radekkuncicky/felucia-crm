// SECURITY FIX: In-memory rate limiter for sensitive endpoints

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  store.forEach((entry, key) => {
    if (entry.resetAt < now) store.delete(key)
  })
}, 5 * 60 * 1000)

/**
 * Check rate limit for a given key.
 * Returns { limited: true } when the limit is exceeded.
 *
 * @param key      - Unique identifier, e.g. "login:1.2.3.4"
 * @param limit    - Max requests allowed within the window
 * @param windowMs - Window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { limited: boolean; remaining: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { limited: false, remaining: limit - 1 }
  }

  entry.count++
  if (entry.count > limit) {
    return { limited: true, remaining: 0 }
  }

  return { limited: false, remaining: limit - entry.count }
}

/**
 * Extract the best available client IP from request headers (behind Nginx).
 * X-Real-IP je nastavené natvrdo nginx configem (`$remote_addr`) — klient ho
 * nemůže přepsat. X-Forwarded-For naproti tomu nginx jen DOPLŇUJE
 * (`$proxy_add_x_forwarded_for`) za cokoliv, co klient sám pošle — jeho první
 * hodnota je tedy klientem ovlivnitelná a nesmí se jí věřit jako primárnímu
 * zdroji (jinak jde per-IP rate limit obejít rotací hlavičky).
 */
export function getClientIp(req: Request): string {
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return 'unknown'
}
