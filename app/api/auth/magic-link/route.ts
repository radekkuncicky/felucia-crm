import { prisma } from '@/lib/prisma'
import { issueMagicLinkToken } from '@/lib/authTokens'
import { NextResponse } from 'next/server'
import { sendEmail, emailMagicLink } from '@/lib/email'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function POST(req: Request) {
  // SECURITY FIX: Rate limit magic link requests — max 5 per hour per IP to prevent email flooding
  const ip = getClientIp(req)
  const { limited } = checkRateLimit(`magic-link:${ip}`, 5, 60 * 60 * 1000)
  if (limited) {
    return NextResponse.json({ error: 'Příliš mnoho požadavků. Zkuste to za hodinu.' }, { status: 429 })
  }

  const { email } = await req.json()
  if (typeof email !== 'string' || !email.trim()) return NextResponse.json({ error: 'Email je povinný' }, { status: 400 })

  // Always return 200 to prevent enumeration; při shodě e-mailu ve více org odkaz pro každý účet
  const users = await prisma.user.findMany({
    where: { email: email.trim(), aktivni: true, organization: { aktivni: true } },
    include: { organization: { select: { nazev: true } } },
  })
  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://felucia.io'
  for (const user of users) {
    const token = await issueMagicLinkToken(prisma, user.id, 15 * 60 * 1000) // 15 minutes
    // Stránka je app/(auth)/magic-link (bez /auth prefixu)
    const url = `${baseUrl}/magic-link?token=${token}`
    const subject = users.length > 1 ? `Přihlaste se do FELUCIA CRM (${user.organization.nazev})` : 'Přihlaste se do FELUCIA CRM'
    try {
      await sendEmail(user.email, subject, emailMagicLink(user.jmeno, url))
    } catch (err) {
      console.error('Magic link email error:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
