import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { sendEmail } from '@/lib/email'
import crypto from 'crypto'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = session.user

  const body = await req.json()
  const emails: string[] = (body.emails ?? []).filter((e: string) => e?.trim())

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { slug: true, nazev: true },
  })

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'
  const sent: string[] = []

  for (const email of emails.slice(0, 5)) {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) continue

    // Skip if already exists
    const existing = await prisma.user.findFirst({ where: { email: trimmed } })
    if (existing) continue

    // Create user with temp password
    const tempPassword = crypto.randomBytes(16).toString('hex')
    const hesloHash = await bcrypt.hash(tempPassword, 12)

    const newUser = await prisma.user.create({
      data: {
        orgId,
        jmeno: trimmed.split('@')[0],
        email: trimmed,
        hesloHash,
        role: 'OBCHODNIK',
      },
    })

    // Create magic link token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    await prisma.magicLinkToken.create({
      data: { userId: newUser.id, token, expiresAt },
    })

    const loginUrl = process.env.NODE_ENV === 'development'
      ? `http://localhost:3000/magic-link?token=${token}`
      : `https://${org?.slug}.${rootDomain}/magic-link?token=${token}`

    if (process.env.SMTP_HOST) {
      try {
        await sendEmail(
          trimmed,
          `Pozvánka do ${org?.nazev ?? 'FELUCIA CRM'}`,
          `<p>Byl/a jste pozván/a do CRM systému <strong>${org?.nazev ?? 'FELUCIA CRM'}</strong>.</p>
           <p>Klikněte na odkaz pro přihlášení:</p>
           <p><a href="${loginUrl}" style="color:#4CAF50;font-weight:bold;">Přihlásit se →</a></p>
           <p style="color:#666;font-size:12px;">Odkaz je platný 7 dní.</p>`
        )
      } catch {
        // Email failure is not critical
      }
    }

    sent.push(trimmed)
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { onboardingStep: 6 },
  })

  return NextResponse.json({ ok: true, sent })
}
