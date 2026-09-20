import { prisma } from '@/lib/prisma'
import { resolvePermissions } from '@/lib/permissions'
import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { secret } from '@/lib/mobile-auth'
import { logAction } from '@/lib/auditLog'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import bcrypt from 'bcryptjs'

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

export async function POST(req: Request) {
  // SECURITY FIX: Rate limit mobile login — max 10 attempts per IP per minute to prevent brute force
  const ip = getClientIp(req)
  const { limited } = checkRateLimit(`mobile-login:${ip}`, 10, 60 * 1000)
  if (limited) {
    return NextResponse.json({ error: 'Příliš mnoho pokusů. Zkuste to za chvíli.' }, { status: 429 })
  }

  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Neplatný požadavek' }, { status: 400 })
  }

  const { email, password } = body
  if (!email || !password) {
    return NextResponse.json({ error: 'Email a heslo jsou povinné' }, { status: 400 })
  }

  // SECURITY FIX: Basic email format validation to reject obviously invalid inputs early
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Neplatné přihlašovací údaje' }, { status: 401 })
  }

  // Email je unikátní jen per firma (@@unique([orgId, email])), ne globálně —
  // appka posílá jen email+heslo bez kódu organizace, takže při shodě e-mailu
  // napříč firmami musí heslo rozhodnout, ke kterému účtu se přihlašujeme.
  const candidates = await prisma.user.findMany({
    where: { email, aktivni: true },
    include: { organization: { select: { aktivni: true, slug: true, plan: true } } },
  })

  let user: (typeof candidates)[number] | null = null
  for (const candidate of candidates) {
    if (!candidate.organization.aktivni) continue
    if (await bcrypt.compare(password, candidate.hesloHash)) {
      user = candidate
      break
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'Neplatné přihlašovací údaje' }, { status: 401 })
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 // 30 days

  const token = await new SignJWT({
    userId: user.id,
    orgId: user.orgId,
    orgSlug: user.organization.slug,
    role: user.role,
    plan: user.organization.plan,
    sv: user.sessionVersion,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret)

  await logAction({
    orgId: user.orgId,
    userId: user.id,
    typAkce: 'CREATE',
    typZaznamu: 'MobileLogin',
    zaznamId: user.id,
    zaznamNazev: `Mobilní přihlášení: ${user.email}`,
  })

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      jmeno: user.jmeno,
      email: user.email,
      role: user.role,
      perms: resolvePermissions(user.role, user.permissions, user.organization.plan),
      orgSlug: user.organization.slug,
      plan: user.organization.plan,
    },
  })
}
