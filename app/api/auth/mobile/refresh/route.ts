import { NextResponse } from 'next/server'
import { jwtVerify, SignJWT, type JWTPayload } from 'jose'
import { secret } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { resolvePermissions } from '@/lib/permissions'

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

  // Ověř, že uživatel i org jsou stále aktivní — bez tohoto by deaktivovaný
  // technik mohl donekonečna obnovovat token, protože JWT je self-contained.
  const user = await prisma.user.findFirst({
    where: { id: payload.userId, aktivni: true },
    include: { organization: { select: { aktivni: true, plan: true } } },
  })
  if (!user || !user.organization?.aktivni) {
    return NextResponse.json({ error: 'Účet byl deaktivován' }, { status: 401 })
  }
  if (payload.sv !== undefined && payload.sv !== user.sessionVersion) {
    return NextResponse.json({ error: 'Token byl zneplatněn, přihlaste se znovu' }, { status: 401 })
  }

  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 // 30 days

  const newToken = await new SignJWT({
    userId: payload.userId,
    orgId: payload.orgId,
    orgSlug: payload.orgSlug,
    role: user.role,
    plan: user.organization.plan,
    sv: user.sessionVersion,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret)

  return NextResponse.json({
    token: newToken,
    user: { role: user.role, perms: resolvePermissions(user.role, user.permissions, user.organization.plan) },
  })
}
