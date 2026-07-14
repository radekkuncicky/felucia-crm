import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { decryptSecret } from '@/lib/secretCrypto'
import { orgTransporter, orgFromHeader, type OrgSmtpConfig } from '@/lib/email'

// Známé SMTP chyby přeložené do češtiny s návodem — surová hláška serveru
// se přidá pod to, ať jde problém dohledat.
function prelozSmtpChybu(raw: string): string {
  const l = raw.toLowerCase()
  if (l.includes('smtpclientauthentication is disabled')) {
    return 'Váš Microsoft 365 účet má vypnuté SMTP přihlašování. Správce ho musí povolit: '
      + 'Microsoft 365 admin centrum → Uživatelé → Aktivní uživatelé → vybrat uživatele → záložka Pošta '
      + '→ Spravovat e-mailové aplikace → zaškrtnout „Ověřený protokol SMTP". Změna se projeví do ~1 hodiny.'
      + `\n\nOdpověď serveru: ${raw}`
  }
  if (l.includes('username and password not accepted') || l.includes('invalid login') || l.includes('535')) {
    return 'Server odmítl přihlášení — zkontrolujte přihlašovací jméno a heslo. '
      + 'U Gmailu je nutné „heslo pro aplikace" (ne běžné heslo), u Seznamu musí být SMTP povoleno v nastavení schránky.'
      + `\n\nOdpověď serveru: ${raw}`
  }
  if (l.includes('econnrefused') || l.includes('enotfound') || l.includes('getaddrinfo')) {
    return 'Na SMTP server se nepodařilo připojit — zkontrolujte adresu serveru a port.'
      + `\n\nDetail: ${raw}`
  }
  if (l.includes('timeout') || l.includes('etimedout') || l.includes('greeting')) {
    return 'Server neodpověděl včas — zkontrolujte port (obvykle 465 se SSL, nebo 587) a případný firewall.'
      + `\n\nDetail: ${raw}`
  }
  if (l.includes('certificate') || l.includes('ssl') || l.includes('tls')) {
    return 'Problém se zabezpečením spojení — zkuste přepnout SSL (port 465 = SSL zapnuto, port 587 = vypnuto).'
      + `\n\nDetail: ${raw}`
  }
  return raw
}

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
    return NextResponse.json({ error: prelozSmtpChybu(msg) }, { status: 422 })
  }

  const saved = await db.orgEmailSettings.update({
    where: { orgId },
    data: { overeno: new Date() },
  })
  return NextResponse.json({ ok: true, overeno: saved.overeno, to })
}
