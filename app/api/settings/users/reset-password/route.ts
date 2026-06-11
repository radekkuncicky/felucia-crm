import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { sendEmail, emailResetPassword } from '@/lib/email'

// POST /api/settings/users/reset-password  { userId }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId je povinný' }, { status: 400 })

  const user = await prisma.user.findFirst({
    where: { id: userId, orgId: session.user.orgId, aktivni: true },
  })
  if (!user) return NextResponse.json({ error: 'Uživatel nenalezen' }, { status: 404 })

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

  await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } })

  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://crm.workspace-felucia.io'
  const url = `${baseUrl}/auth/reset-password?token=${token}`

  try {
    await sendEmail(user.email, 'Obnova hesla – FELUCIA CRM', emailResetPassword(user.jmeno, url))
  } catch (err) {
    console.error('Reset password email error:', err)
    return NextResponse.json({ error: 'Nepodařilo se odeslat email. Zkontrolujte SMTP nastavení.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
