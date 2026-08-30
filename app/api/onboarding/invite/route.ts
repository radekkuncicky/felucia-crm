import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { sendOrgEmail, isOrgEmailConfigured } from '@/lib/email'
import { checkUserLimit } from '@/lib/checkPlanLimit'
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
  const emailConfigured = await isOrgEmailConfigured(orgId)
  const sent: string[] = []
  const skipped: { email: string; reason: string }[] = []
  let planLimitReached = false

  for (const email of emails.slice(0, 5)) {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) continue

    // Duplicita se kontroluje per-org (User.email je unikátní jen v rámci orgId,
    // stejný email v jiné organizaci je legitimní a nesmí pozvánku zablokovat)
    const existing = await prisma.user.findFirst({ where: { orgId, email: trimmed } })
    if (existing) {
      skipped.push({ email: trimmed, reason: 'Uživatel s tímto e-mailem už v organizaci existuje' })
      continue
    }

    if (!emailConfigured) {
      skipped.push({ email: trimmed, reason: 'Odesílání e-mailů není nastaveno' })
      continue
    }

    // Pozvánka zakládá plnohodnotného uživatele, takže musí projít limitem plánu
    // stejně jako /api/settings/users. Kontroluje se v každé iteraci — každý
    // založený kolega ubírá slot. Na STARTERu (1 uživatel = sám admin) tak
    // pozvánky neprojdou vůbec, proto se vrací i upgradeUrl.
    if (!(await checkUserLimit(orgId))) {
      planLimitReached = true
      skipped.push({ email: trimmed, reason: 'Limit uživatelů ve vašem plánu je vyčerpán' })
      continue
    }

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

    try {
      await sendOrgEmail(
        orgId,
        trimmed,
        `Pozvánka do ${org?.nazev ?? 'FELUCIA CRM'}`,
        `<p>Byl/a jste pozván/a do CRM systému <strong>${org?.nazev ?? 'FELUCIA CRM'}</strong>.</p>
         <p>Klikněte na odkaz pro přihlášení:</p>
         <p><a href="${loginUrl}" style="color:#4CAF50;font-weight:bold;">Přihlásit se →</a></p>
         <p style="color:#666;font-size:12px;">Odkaz je platný 7 dní.</p>`
      )
      sent.push(trimmed)
    } catch (err) {
      console.error('Onboarding invite email error:', err)
      // Uživatele i token zase smazat (token přes onDelete: Cascade) — jinak by
      // zůstal účet s náhodným heslem a nedoručeným odkazem a opakovaná pozvánka
      // by spadla do větve „už existuje" výše.
      try {
        await prisma.user.delete({ where: { id: newUser.id } })
      } catch (cleanupErr) {
        console.error('Onboarding invite rollback error:', cleanupErr)
      }
      skipped.push({ email: trimmed, reason: 'Odeslání e-mailu selhalo' })
    }
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { onboardingStep: 6 },
  })

  return NextResponse.json({
    ok: true,
    sent,
    skipped,
    ...(planLimitReached ? { planLimitReached, upgradeUrl: '/settings/billing' } : {}),
  })
}
