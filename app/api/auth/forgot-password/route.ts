import { prisma } from '@/lib/prisma'
import { issuePasswordResetToken } from '@/lib/authTokens'
import { NextResponse } from 'next/server'
import { sendOrgEmail, isOrgEmailConfigured, emailResetPassword } from '@/lib/email'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { normalizeEmail, emailWhere, isValidEmail } from '@/lib/authInput'
import { orgBaseUrl } from '@/lib/authCookie'

export async function POST(req: Request) {
  // SECURITY FIX: Rate limit password reset requests — max 5 per hour per IP to prevent email flooding
  const ip = getClientIp(req)
  const { limited } = checkRateLimit(`forgot-password:${ip}`, 5, 60 * 60 * 1000)
  if (limited) {
    return NextResponse.json({ error: 'Příliš mnoho požadavků z této sítě. Zkuste to za hodinu, nebo požádejte správce firmy o odkaz.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  // Jen string — objekt by prošel jako Prisma StringFilter (startsWith…) = enumerace
  const email = normalizeEmail(body?.email)
  if (!email) return NextResponse.json({ error: 'Vyplňte e-mail.' }, { status: 400 })
  if (!isValidEmail(email)) return NextResponse.json({ error: 'Zkontrolujte e-mail — nevypadá jako platná adresa.' }, { status: 400 })

  // Always return 200 to prevent email enumeration. E-mail je unikátní jen per
  // org — při shodě ve více org dostane odkaz každý účet (majitel schránky).
  // Odkaz vede na adresu firmy a jde přes SMTP firmy (vlastní nebo centrální).
  const users = await prisma.user.findMany({
    where: { email: emailWhere(email), aktivni: true, organization: { aktivni: true } },
    include: { organization: { select: { nazev: true, slug: true } } },
  })
  for (const user of users) {
    if (!(await isOrgEmailConfigured(user.orgId))) {
      console.warn('[forgot-password] e-mail není nastavený pro org', user.orgId)
      continue
    }
    const token = await issuePasswordResetToken(prisma, user.id, 60 * 60 * 1000) // 1 hour
    const url = `${orgBaseUrl(user.organization.slug)}/reset-password?token=${token}`
    const subject = users.length > 1 ? `Obnova hesla – Felucia (${user.organization.nazev})` : 'Obnova hesla – Felucia'
    try {
      await sendOrgEmail(user.orgId, user.email, subject, emailResetPassword(user.jmeno, url))
    } catch (err) {
      console.error('Email send error:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
