import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Podepsaná hodnota cookie: `base64url(json).hmac`. Cookie je httpOnly, ale
 * bez podpisu by ji šlo podvrhnout z jiného kanálu (XSS na jiné subdoméně,
 * ruční úprava) — obsah by se pak bral jako důvěryhodný (impersonace).
 */
function key(): string {
  const s = process.env.NEXTAUTH_SECRET
  if (!s) throw new Error('NEXTAUTH_SECRET chybí')
  return s
}

function mac(payload: string, purpose: string): string {
  return createHmac('sha256', key()).update(`${purpose}:${payload}`).digest('base64url')
}

export function signCookieValue(value: unknown, purpose: string): string {
  const payload = Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
  return `${payload}.${mac(payload, purpose)}`
}

export function verifyCookieValue<T>(raw: string | undefined | null, purpose: string): T | null {
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return null
  const payload = raw.slice(0, dot)
  const sig = Buffer.from(raw.slice(dot + 1))
  const expected = Buffer.from(mac(payload, purpose))
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T
  } catch {
    return null
  }
}
