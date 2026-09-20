import { SignJWT } from 'jose'

// QR token zařízení (štítek na jednotce → veřejná stránka / mobilní sken).
// Sdílené mezi /api/servis/zarizeni, handoffem ze zakázky a servis/nova.
export async function signZarizeniQrToken(zarizeniId: string, orgId: string) {
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? '')
  return new SignJWT({ zarizeniId, orgId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10y')
    .sign(secret)
}
