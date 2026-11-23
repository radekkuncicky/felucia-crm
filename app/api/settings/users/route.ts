import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { checkUserLimit } from '@/lib/checkPlanLimit'
import { logAction } from '@/lib/auditLog'
import { posliPozvanku } from '@/lib/userInvite'
import { normalizeEmail, isValidEmail, emailWhere, passwordError } from '@/lib/authInput'
import { getPerms, isRoleName } from '@/lib/permissions'

const USER_SELECT = { id: true, jmeno: true, email: true, role: true, aktivni: true, vytvoreno: true, podepisujeSmlouvy: true, permissions: true, lastLoginAt: true } as const

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).spravaUzivatelu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const users = await db.user.findMany({
    where: { orgId },
    select: USER_SELECT,
    orderBy: { vytvoreno: 'asc' },
  })
  return NextResponse.json(users)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).spravaUzivatelu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const body = await req.json()
  const jmeno = typeof body.jmeno === 'string' ? body.jmeno.trim() : ''
  const email = normalizeEmail(body.email)
  const role = isRoleName(body.role) ? body.role : 'OBCHODNIK'
  // Výchozí cesta: pozvánka — uživatel si heslo nastaví sám odkazem z e-mailu.
  // Heslo od admina je jen volitelná varianta (kolega bez e-mailu po ruce).
  const rucniHeslo = typeof body.heslo === 'string' && body.heslo.length > 0 ? body.heslo : null

  if (!jmeno || !email) {
    return NextResponse.json({ error: 'Vyplňte jméno a e-mail' }, { status: 400 })
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Neplatný e-mail' }, { status: 400 })
  }
  if (rucniHeslo) {
    const chyba = passwordError(rucniHeslo)
    if (chyba) return NextResponse.json({ error: chyba }, { status: 400 })
  }

  const exists = await db.user.findFirst({ where: { orgId, email: emailWhere(email) }, select: { aktivni: true } })
  if (exists) {
    return NextResponse.json({
      error: exists.aktivni
        ? 'Uživatel s tímto e-mailem už ve firmě je.'
        : 'Uživatel s tímto e-mailem už ve firmě je, ale je deaktivovaný — najděte ho v seznamu a klikněte na Aktivovat.',
    }, { status: 400 })
  }

  const canAdd = await checkUserLimit(orgId)
  if (!canAdd) {
    return NextResponse.json({
      error: 'Dosáhli jste limitu uživatelů pro váš plán. Pro dalšího uživatele přejděte na vyšší plán.',
      code: 'PLAN_LIMIT_REACHED',
      upgradeUrl: '/settings/billing',
    }, { status: 403 })
  }

  const hesloHash = await bcrypt.hash(rucniHeslo ?? crypto.randomBytes(24).toString('hex'), 12)
  const user = await db.user.create({
    data: { orgId, jmeno, email, hesloHash, role },
    select: USER_SELECT,
  })

  await logAction({
    orgId,
    userId: session.user.id,
    typAkce: 'CREATE',
    typZaznamu: 'User',
    zaznamId: user.id,
    zaznamNazev: `${user.jmeno} (${user.email})`,
    zmeny: { jmeno, email, role: user.role, pozvanka: !rucniHeslo },
  })

  if (rucniHeslo) {
    return NextResponse.json({ ...user, inviteUrl: null, inviteEmailSent: false, inviteEmailError: null }, { status: 201 })
  }

  const pozvanka = await posliPozvanku(db, { orgId, user, kdoZve: session.user.jmeno })
  return NextResponse.json({
    ...user,
    inviteUrl: pozvanka.url,
    inviteEmailSent: pozvanka.emailSent,
    inviteEmailError: pozvanka.emailError,
  }, { status: 201 })
}
