import { getServerSession } from 'next-auth'
import { isInternalHost } from '@/lib/webhooks'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { encryptSecret } from '@/lib/secretCrypto'
import { isEmailConfigured } from '@/lib/email'
import { getPerms } from '@/lib/permissions'

function publicShape(s: {
  rezim: string; smtpHost: string | null; smtpPort: number; smtpSecure: boolean
  smtpUser: string | null; fromName: string | null; fromEmail: string; overeno: Date | null
} | null) {
  return {
    configured: !!s,
    globalFallback: isEmailConfigured(),
    settings: s
      ? {
          rezim: s.rezim,
          smtpHost: s.smtpHost,
          smtpPort: s.smtpPort,
          smtpSecure: s.smtpSecure,
          smtpUser: s.smtpUser,
          fromName: s.fromName,
          fromEmail: s.fromEmail,
          overeno: s.overeno,
        }
      : null,
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).nastaveniOrg) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const db = orgPrisma(session.user.orgId)
  const s = await db.orgEmailSettings.findUnique({ where: { orgId: session.user.orgId } })
  return NextResponse.json(publicShape(s))
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).nastaveniOrg) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const body = await req.json()
  const rezim = body.rezim === 'VLASTNI_SMTP' ? 'VLASTNI_SMTP' : 'FELUCIA'
  const smtpHost = String(body.smtpHost ?? '').trim()
  const smtpPort = Number(body.smtpPort)
  const smtpSecure = !!body.smtpSecure
  const smtpUser = String(body.smtpUser ?? '').trim()
  const smtpPass = typeof body.smtpPass === 'string' ? body.smtpPass : ''
  const fromName = String(body.fromName ?? '').trim() || null
  const fromEmail = String(body.fromEmail ?? '').trim()

  if (!fromEmail) {
    return NextResponse.json({ error: 'Vyplňte firemní e-mail' }, { status: 422 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
    return NextResponse.json({ error: 'Neplatný e-mail' }, { status: 422 })
  }

  const existing = await db.orgEmailSettings.findUnique({ where: { orgId } })

  if (rezim === 'VLASTNI_SMTP') {
    if (!smtpHost || !smtpUser) {
      return NextResponse.json({ error: 'Vyplňte SMTP server a přihlašovací jméno' }, { status: 422 })
    }
    // SMTP test by jinak fungoval jako port scan vnitřní sítě serveru
    if (isInternalHost(smtpHost) || !/^[a-z0-9.-]+$/i.test(smtpHost)) {
      return NextResponse.json({ error: 'Neplatná adresa SMTP serveru' }, { status: 422 })
    }
    if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
      return NextResponse.json({ error: 'Neplatný port' }, { status: 422 })
    }
    if (!existing?.smtpPassEnc && !smtpPass) {
      return NextResponse.json({ error: 'Zadejte heslo k SMTP účtu' }, { status: 422 })
    }
  }

  // změna nastavení ruší dřívější ověření; heslo se přepisuje jen když přišlo nové
  const data =
    rezim === 'VLASTNI_SMTP'
      ? {
          rezim,
          smtpHost,
          smtpPort,
          smtpSecure,
          smtpUser,
          fromName,
          fromEmail,
          overeno: null,
          ...(smtpPass ? { smtpPassEnc: encryptSecret(smtpPass) } : {}),
        }
      : // FELUCIA: SMTP údaje se čistí, identita stačí
        {
          rezim,
          smtpHost: null,
          smtpUser: null,
          smtpPassEnc: null,
          fromName,
          fromEmail,
          overeno: null,
        }

  const saved = existing
    ? await db.orgEmailSettings.update({ where: { orgId }, data })
    : await db.orgEmailSettings.create({ data: { ...data, orgId } })

  return NextResponse.json(publicShape(saved))
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).nastaveniOrg) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  await db.orgEmailSettings.deleteMany({ where: { orgId } })
  return NextResponse.json(publicShape(null))
}
