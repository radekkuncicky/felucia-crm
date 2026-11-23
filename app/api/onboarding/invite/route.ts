import { getServerSession } from 'next-auth'
import { posliPozvanku } from '@/lib/userInvite'
import { normalizeEmail, isValidEmail, emailWhere } from '@/lib/authInput'
import { logAction } from '@/lib/auditLog'
import { forbidden, getPerms } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { checkUserLimit } from '@/lib/checkPlanLimit'
import crypto from 'crypto'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).spravaUzivatelu) return forbidden()
  const { orgId } = session.user

  const body = await req.json()
  const emails: string[] = (Array.isArray(body.emails) ? body.emails : []).filter((e: unknown): e is string => typeof e === 'string' && !!e.trim())

  // Pozvánka se vytvoří vždy a odkaz se vrací adminovi do UI — e-mail je jen
  // doručovací kanál navíc. Když nedorazí (chybí SMTP, spam/karanténa), admin
  // pošle odkaz kolegovi ručně jiným kanálem. Odkaz vede na nastavení hesla
  // (ne jednorázové přihlášení) — jinak by pozvaný nikdy neměl heslo.
  const sent: { email: string; inviteUrl: string; emailSent: boolean; emailError?: string }[] = []
  const skipped: { email: string; reason: string }[] = []
  let planLimitReached = false

  for (const email of emails.slice(0, 5)) {
    const trimmed = normalizeEmail(email)
    if (!trimmed) continue
    if (!isValidEmail(trimmed)) {
      skipped.push({ email: trimmed, reason: 'Neplatný e-mail' })
      continue
    }

    // Duplicita se kontroluje per-org (User.email je unikátní jen v rámci orgId,
    // stejný email v jiné organizaci je legitimní a nesmí pozvánku zablokovat)
    const existing = await prisma.user.findFirst({ where: { orgId, email: emailWhere(trimmed) } })
    if (existing) {
      skipped.push({ email: trimmed, reason: 'Uživatel s tímto e-mailem už v organizaci existuje' })
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

    const hesloHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12)
    const newUser = await prisma.user.create({
      data: {
        orgId,
        jmeno: trimmed.split('@')[0],
        email: trimmed,
        hesloHash,
        role: 'OBCHODNIK',
      },
    })

    await logAction({
      orgId,
      userId: session.user.id,
      typAkce: 'CREATE',
      typZaznamu: 'User',
      zaznamId: newUser.id,
      zaznamNazev: `${newUser.jmeno} (${newUser.email})`,
      zmeny: { email: trimmed, role: newUser.role, zdroj: 'onboarding-invite' },
    })

    const p = await posliPozvanku(prisma, { orgId, user: newUser, kdoZve: session.user.jmeno })
    sent.push({ email: trimmed, inviteUrl: p.url, emailSent: p.emailSent, ...(p.emailError ? { emailError: p.emailError } : {}) })
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
