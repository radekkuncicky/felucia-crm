import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { checkUserLimit } from '@/lib/checkPlanLimit'
import { logAction } from '@/lib/auditLog'
import { sendOrgEmail, emailTechnikInvite, isOrgEmailConfigured } from '@/lib/email'
import { getPerms, isRoleName } from '@/lib/permissions'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).spravaUzivatelu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const users = await db.user.findMany({
    where: { orgId },
    select: { id: true, jmeno: true, email: true, role: true, aktivni: true, vytvoreno: true, podepisujeSmlouvy: true, permissions: true },
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
  const { jmeno, email } = body
  let { heslo } = body
  const role = isRoleName(body.role) ? body.role : 'OBCHODNIK'
  // Technici si heslo nastavují sami přes pozvánku do appky Felucia Tech
  const isTechnik = role === 'TECHNIK' || role === 'HLAVNI_TECHNIK'

  // Technik si heslo nastavuje sám přes pozvánkový email (viz níže) — admin ho vymýšlet nemusí
  if (isTechnik && !heslo) {
    heslo = crypto.randomBytes(16).toString('hex')
  }

  if (!jmeno || !email || !heslo) {
    return NextResponse.json({ error: 'Jméno, email a heslo jsou povinné' }, { status: 400 })
  }

  const canAdd = await checkUserLimit(orgId)
  if (!canAdd) {
    return NextResponse.json({
      error: 'PLAN_LIMIT_REACHED',
      message: 'Dosáhli jste limitu uživatelů pro váš plán.',
      upgradeUrl: '/settings/billing',
    }, { status: 403 })
  }

  const exists = await db.user.findFirst({ where: { orgId, email } })
  if (exists) return NextResponse.json({ error: 'Email již existuje' }, { status: 400 })

  const hesloHash = await bcrypt.hash(heslo, 12)
  const user = await db.user.create({
    data: { orgId, jmeno, email, hesloHash, role },
    select: { id: true, jmeno: true, email: true, role: true, aktivni: true, vytvoreno: true, podepisujeSmlouvy: true, permissions: true },
  })

  await logAction({
    orgId,
    userId: session.user.id,
    typAkce: 'CREATE',
    typZaznamu: 'User',
    zaznamId: user.id,
    zaznamNazev: `${user.jmeno} (${user.email})`,
    zmeny: { jmeno, email, role: user.role },
  })

  let inviteEmailSent = false
  let inviteEmailError: string | null = null

  if (isTechnik) {
    if (await isOrgEmailConfigured(orgId)) {
      try {
        const token = crypto.randomBytes(32).toString('hex')
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        await db.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } })

        const baseUrl = process.env.NEXTAUTH_URL ?? 'https://crm.workspace-felucia.io'
        const setPasswordUrl = `${baseUrl}/reset-password?token=${token}`
        const appDownloadUrl = process.env.FELUCIA_TECH_APP_URL

        await sendOrgEmail(orgId, user.email, 'Přístup do aplikace Felucia Tech', emailTechnikInvite(user.jmeno, setPasswordUrl, appDownloadUrl))
        inviteEmailSent = true
      } catch (err) {
        console.error('Technik invite email error:', err)
        inviteEmailError = 'Pozvánku se nepodařilo odeslat e-mailem.'
      }
    } else {
      inviteEmailError = 'Odesílání e-mailů není nastaveno — pošlete techniku reset odkaz ručně přes "Reset hesla" po nastavení SMTP.'
    }
  }

  return NextResponse.json({ ...user, inviteEmailSent, inviteEmailError }, { status: 201 })
}
