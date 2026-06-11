import { jwtVerify, type JWTPayload } from 'jose'
import { NextRequest } from 'next/server'

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)

interface MobileTokenPayload extends JWTPayload {
  userId: string
  orgId: string
  orgSlug: string
  role: string
  plan: string
}

export async function getMobileSession(req: NextRequest | Request) {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null

  const token = auth.slice(7)
  try {
    const { payload } = await jwtVerify(token, secret)
    const p = payload as MobileTokenPayload
    if (!p.userId || !p.orgId) return null
    return {
      user: {
        id: p.userId,
        orgId: p.orgId,
        orgSlug: p.orgSlug ?? '',
        role: p.role as 'ADMIN' | 'OBCHODNIK' | 'TECHNIK',
        plan: p.plan ?? 'STARTER',
        jmeno: '',
        email: '',
        isSuperAdmin: false,
      },
    }
  } catch {
    return null
  }
}

export { secret }
