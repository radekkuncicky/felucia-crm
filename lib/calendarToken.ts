import crypto from 'crypto'

/**
 * Token pro odběr ICS kalendáře: HMAC(secret, userId + verze). Nic se neukládá,
 * odvolání = zvýšení User.calendarTokenVersion (odkaz v Google/Apple kalendáři
 * bývalého zaměstnance přestane fungovat). Deaktivaci uživatele/org hlídá
 * route sama.
 */
export function getCalendarToken(userId: string, version: number): string {
  return crypto
    .createHmac('sha256', process.env.NEXTAUTH_SECRET!)
    .update(`cal:${userId}:${version}`)
    .digest('hex')
    .slice(0, 32)
}

export function verifyCalendarToken(userId: string, version: number, token: string): boolean {
  const expected = Buffer.from(getCalendarToken(userId, version))
  const given = Buffer.from(token)
  return expected.length === given.length && crypto.timingSafeEqual(expected, given)
}
