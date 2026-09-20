import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { sendEmail, emailResetPassword } from '@/lib/email'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function POST(req: Request) {
  // SECURITY FIX: Rate limit password reset requests — max 5 per hour per IP to prevent email flooding
  const ip = getClientIp(req)
  const { limited } = checkRateLimit(`forgot-password:${ip}`, 5, 60 * 60 * 1000)
  if (limited) {
    return NextResponse.json({ error: 'Příliš mnoho požadavků. Zkuste to za hodinu.' }, { status: 429 })
  }

  const { email } = await req.json()
  // Jen string — objekt by prošel jako Prisma StringFilter (startsWith…) = enumerace
  if (typeof email !== 'string' || !email.trim()) return NextResponse.json({ error: 'Email je povinný' }, { status: 400 })

  // Always return 200 to prevent email enumeration. E-mail je unikátní jen per
  // org — při shodě ve více org dostane odkaz každý účet (majitel schránky).
  const users = await prisma.user.findMany({
    where: { email: email.trim(), aktivni: true, organization: { aktivni: true } },
    include: { organization: { select: { nazev: true } } },
  })
  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://felucia.io'
  for (const user of users) {
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } })
    const url = `${baseUrl}/reset-password?token=${token}`
    const subject = users.length > 1 ? `Obnova hesla – FELUCIA CRM (${user.organization.nazev})` : 'Obnova hesla – FELUCIA CRM'
    try {
      await sendEmail(user.email, subject, emailResetPassword(user.jmeno, url))
    } catch (err) {
      console.error('Email send error:', err)
      // Don't fail the request — token is in DB, admin can re-send
    }
  }

  return NextResponse.json({ ok: true })
}
