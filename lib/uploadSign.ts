import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Podepsané odkazy na soubory v /uploads pro klienty bez session cookie
 * (mobilní appky přes RN `Image`). Podpis = HMAC(NEXTAUTH_SECRET, cesta|exp),
 * platnost omezená; cesta bez query. Ověřuje route handler /api/uploads.
 */
export const UPLOAD_SIGN_TTL_SEC = 7 * 24 * 3600

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET
  if (!s) throw new Error('NEXTAUTH_SECRET chybí')
  return s
}

function hmac(rel: string, exp: number): string {
  return createHmac('sha256', secret()).update(`upload:${rel}|${exp}`).digest('base64url')
}

/** `/uploads/x/y.jpg` → `/uploads/x/y.jpg?exp=…&sig=…` (jen pro relativní /uploads cesty, jinak beze změny) */
export function signUploadUrl(rel: string, ttlSec = UPLOAD_SIGN_TTL_SEC, now = Date.now()): string {
  if (!rel.startsWith('/uploads/')) return rel
  const exp = Math.floor(now / 1000) + ttlSec
  return `${rel}?exp=${exp}&sig=${hmac(rel, exp)}`
}

export function verifyUploadSignature(rel: string, exp: string | null, sig: string | null, now = Date.now()): boolean {
  if (!exp || !sig || !/^\d{1,12}$/.test(exp)) return false
  const expNum = Number(exp)
  if (expNum * 1000 < now) return false
  const expected = Buffer.from(hmac(rel, expNum))
  const given = Buffer.from(sig)
  return expected.length === given.length && timingSafeEqual(expected, given)
}
