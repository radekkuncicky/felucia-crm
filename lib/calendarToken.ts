import crypto from 'crypto'

export function getCalendarToken(userId: string): string {
  return crypto
    .createHmac('sha256', process.env.NEXTAUTH_SECRET!)
    .update(`cal:${userId}`)
    .digest('hex')
    .slice(0, 32)
}

export function verifyCalendarToken(userId: string, token: string): boolean {
  return crypto.timingSafeEqual(
    Buffer.from(getCalendarToken(userId)),
    Buffer.from(token)
  )
}
