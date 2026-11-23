import { prisma } from '@/lib/prisma'
import { resolvePermissions } from '@/lib/permissions'
import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { secret } from '@/lib/mobile-auth'
import { logAction } from '@/lib/auditLog'
import { klientAppky } from '@/lib/mobile-helpers'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import bcrypt from 'bcryptjs'
import { normalizeEmail, emailWhere, isValidEmail } from '@/lib/authInput'

const DUMMY_HASH = bcrypt.hashSync('dummy-' + Math.random().toString(36), 12)

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

  const email = normalizeEmail(body.email)
  const password = typeof body.password === 'string' ? body.password : ''
  if (!email || !password) {
    return NextResponse.json({ error: 'Email a heslo jsou povinné' }, { status: 400 })
  }
  // Stejné texty jako web — appka je zobrazuje uživateli tak, jak přijdou
  const SPATNE = 'Nesprávný e-mail nebo heslo.'
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: SPATNE }, { status: 401 })
  }
  // Per e-mail jako na webu (per IP výš) — technici za jednou firemní wifi si nesdílí limit účtu
  if (checkRateLimit(`mobile-login:email:${email}`, 10, 15 * 60_000).limited) {
    return NextResponse.json({ error: 'Příliš mnoho pokusů o přihlášení. Zkuste to za 15 minut.' }, { status: 429 })
  }

  // Email je unikátní jen per firma (@@unique([orgId, email])), ne globálně —
  // appka posílá jen email+heslo bez kódu organizace, takže při shodě e-mailu
  // napříč firmami musí heslo rozhodnout, ke kterému účtu se přihlašujeme.
  const candidates = await prisma.user.findMany({
    where: { email: emailWhere(email) },
    include: { organization: { select: { aktivni: true, slug: true, plan: true } } },
    orderBy: [{ lastLoginAt: { sort: 'desc', nulls: 'last' } }, { vytvoreno: 'asc' }],
  })
  // Aktivní účty v aktivní firmě napřed
  candidates.sort((a, b) => Number(!(a.aktivni && a.organization.aktivni)) - Number(!(b.aktivni && b.organization.aktivni)))

  let user: (typeof candidates)[number] | null = null
  for (const candidate of candidates) {
    if (await bcrypt.compare(password, candidate.hesloHash)) {
      user = candidate
      break
    }
  }
  if (candidates.length === 0) await bcrypt.compare(password, DUMMY_HASH)

  if (!user) {
    return NextResponse.json({ error: SPATNE }, { status: 401 })
  }
  // Až po ověřeném hesle — srozumitelný důvod, nic neprozrazuje
  if (!user.organization.aktivni) {
    return NextResponse.json({ error: 'Firma má účet ve Felucii pozastavený. Kontaktujte vedení firmy.', code: 'ORG_DISABLED' }, { status: 401 })
  }
  if (!user.aktivni) {
    return NextResponse.json({ error: 'Váš účet byl deaktivován. Kontaktujte správce firmy.', code: 'ACCOUNT_DISABLED' }, { status: 401 })
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
    // platforma a verze appky — ať jde z dat zjistit, kdo má jakou verzi (audit APP_TECHNIK 0.1)
    zmeny: klientAppky(req),
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
