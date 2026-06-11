import { NextResponse } from 'next/server'
import { jwtVerify, SignJWT, type JWTPayload } from 'jose'
import { secret } from '@/lib/mobile-auth'

interface MobileTokenPayload extends JWTPayload {
  userId: string
  orgId: string
  orgSlug: string
  role: string
  plan: string
}

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

export async function POST(req: Request) {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = auth.slice(7)
  let payload: MobileTokenPayload
  try {
    const result = await jwtVerify(token, secret)
    payload = result.payload as MobileTokenPayload
  } catch {
    return NextResponse.json({ error: 'Token neplatný nebo expirovaný' }, { status: 401 })
  }

  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 // 30 days

  const newToken = await new SignJWT({
    userId: payload.userId,
    orgId: payload.orgId,
    orgSlug: payload.orgSlug,
    role: payload.role,
    plan: payload.plan,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret)

  return NextResponse.json({ token: newToken })
}
