import crypto from 'crypto'

// Sdílená fixture pro e2e/podpis.spec.ts (QR nudge testy). Token/OTP jsou
// pevné, aby spec soubor nemusel mluvit s DB — data seeduje e2e/seed.ts
// (běží v izolovaném test env s DATABASE_URL=nanto_crm_test), spec pak
// jen jde na hotovou veřejnou URL. Hash funkce zrcadlí lib/sodPodpis.ts
// (relativní import kvůli tsx/Playwright bez jistoty "@/" aliasu).

export const E2E_PODPIS_ORG_SLUG = 'e2e-podpis-qr-org'
export const E2E_PODPIS_TOKEN = 'e2e-qr-nudge-fixed-token-AAAAAAAAAAAAAAAAAAAA'
export const E2E_PODPIS_OTP = '123456'

export function sha256(v: string): string {
  return crypto.createHash('sha256').update(v).digest('hex')
}

export function otpHash(kod: string, relaceId: string): string {
  const secret = process.env.NEXTAUTH_SECRET!
  return crypto.createHmac('sha256', secret).update(`otp:${relaceId}:${kod}`).digest('hex')
}
