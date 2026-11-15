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

/**
 * Odkazy na odběr ICS (https pro Google, webcal pro iPhone/Outlook).
 * Host z NEXTAUTH_URL — stejný jako v profilu na webu.
 */
export function calendarOdkazy(userId: string, version: number): { https: string; webcal: string } {
  const host = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).host : 'app.felucia.io'
  const proto = host.includes('localhost') ? 'http' : 'https'
  const path = `${host}/api/calendar/ics?uid=${userId}&sig=${getCalendarToken(userId, version)}`
  return { https: `${proto}://${path}`, webcal: `webcal://${path}` }
}
