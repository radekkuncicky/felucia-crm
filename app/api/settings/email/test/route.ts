import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { decryptSecret } from '@/lib/secretCrypto'
import { orgTransporter, orgFromHeader, type OrgSmtpConfig } from '@/lib/email'

// Odešle testovací e-mail na adresu přihlášeného admina přes uložené org SMTP.
// Úspěch nastaví `overeno`; chybu vracíme v textu, ať jde nastavení odladit.
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const s = await db.orgEmailSettings.findUnique({ where: { orgId } })
  if (!s) {
    return NextResponse.json({ error: 'Nejprve uložte SMTP nastavení' }, { status: 422 })
  }
  const to = session.user.email
  if (!to) {
    return NextResponse.json({ error: 'Váš účet nemá e-mailovou adresu' }, { status: 422 })
  }

  const cfg: OrgSmtpConfig = {
    smtpHost: s.smtpHost,
    smtpPort: s.smtpPort,
    smtpSecure: s.smtpSecure,
    smtpUser: s.smtpUser,
    smtpPass: decryptSecret(s.smtpPassEnc),
    fromName: s.fromName,
    fromEmail: s.fromEmail,
  }

  try {
    await orgTransporter(cfg).sendMail({
      from: orgFromHeader(cfg),
      to,
      subject: 'Testovací e-mail — FELUCIA CRM',
      html: `<p>Toto je testovací e-mail z FELUCIA CRM.</p>
<p>Odesílání e-mailů přes <strong>${cfg.smtpHost}</strong> je nastaveno správně.</p>`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Odeslání selhalo'
    return NextResponse.json({ error: `Odeslání selhalo: ${msg}` }, { status: 422 })
  }

  const saved = await db.orgEmailSettings.update({
    where: { orgId },
    data: { overeno: new Date() },
  })
  return NextResponse.json({ ok: true, overeno: saved.overeno, to })
}
