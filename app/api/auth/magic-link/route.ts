import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
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
  if (!email) return NextResponse.json({ error: 'Email je povinný' }, { status: 400 })

  // Always return 200 to prevent enumeration
  const user = await prisma.user.findFirst({ where: { email, aktivni: true } })
  if (!user) return NextResponse.json({ ok: true })

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

  await prisma.magicLinkToken.create({
    data: { userId: user.id, token, expiresAt },
  })

  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://felucia.io'
  const url = `${baseUrl}/auth/magic-link?token=${token}`

  try {
    await sendEmail(user.email, 'Přihlaste se do FELUCIA CRM', emailMagicLink(user.jmeno, url))
  } catch (err) {
    console.error('Magic link email error:', err)
  }

  return NextResponse.json({ ok: true })
}
