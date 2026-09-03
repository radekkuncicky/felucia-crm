import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { sendEmail, emailResetPassword, isEmailConfigured } from '@/lib/email'
import { getPerms } from '@/lib/permissions'

// POST /api/settings/users/reset-password  { userId }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).spravaUzivatelu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId je povinný' }, { status: 400 })

  const user = await orgPrisma(session.user.orgId).user.findFirst({
    where: { id: userId, orgId: session.user.orgId, aktivni: true },
  })
  if (!user) return NextResponse.json({ error: 'Uživatel nenalezen' }, { status: 404 })

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

  const db = orgPrisma(session.user.orgId)
  await db.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } })

  // Odkaz se vrací adminovi do UI vždy — e-mail je jen doručovací kanál navíc;
  // když nedorazí (chybí SMTP, spam/karanténa), admin ho pošle jiným kanálem.
  const org = await db.organization.findUnique({ where: { id: session.user.orgId }, select: { slug: true } })
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'
  const resetUrl = `https://${org?.slug}.${rootDomain}/reset-password?token=${token}`

  let emailSent = false
  if (isEmailConfigured()) {
    try {
      await sendEmail(user.email, 'Obnova hesla – FELUCIA CRM', emailResetPassword(user.jmeno, resetUrl))
      emailSent = true
    } catch (err) {
      console.error('Reset password email error:', err)
    }
  }

  return NextResponse.json({ ok: true, emailSent, resetUrl })
}
