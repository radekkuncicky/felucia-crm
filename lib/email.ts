import nodemailer from 'nodemailer'
import { prisma } from './prisma'
import { decryptSecret } from './secretCrypto'

/** Bez SMTP_HOST je globální odesílání emailů vypnuté (stejný princip jako Sentry DSN) */
export function isEmailConfigured() {
  return !!process.env.SMTP_HOST
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendEmail(to: string, subject: string, html: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? 'FELUCIA CRM <noreply@felucia.io>',
    to,
    subject,
    html,
  })
}

// ─── Per-org odesílání (nastavení v /settings/email) ─────────────────────────

export interface OrgSmtpConfig {
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpPass: string
  fromName: string | null
  fromEmail: string
}

export function orgTransporter(cfg: OrgSmtpConfig) {
  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpSecure,
    auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  })
}

export function orgFromHeader(cfg: OrgSmtpConfig) {
  return cfg.fromName ? `${cfg.fromName} <${cfg.fromEmail}>` : cfg.fromEmail
}

// Bare prisma záměrně: volá se i z workeru a lib kódu bez orgPrisma kontextu,
// orgId sem vždy přichází ze session/serverové logiky, ne od klienta.
async function getOrgSmtpConfig(orgId: string): Promise<OrgSmtpConfig | null> {
  const s = await prisma.orgEmailSettings.findUnique({ where: { orgId } })
  if (!s) return null
  return {
    smtpHost: s.smtpHost,
    smtpPort: s.smtpPort,
    smtpSecure: s.smtpSecure,
    smtpUser: s.smtpUser,
    smtpPass: decryptSecret(s.smtpPassEnc),
    fromName: s.fromName,
    fromEmail: s.fromEmail,
  }
}

/** Org má vlastní SMTP, nebo existuje globální fallback */
export async function isOrgEmailConfigured(orgId: string): Promise<boolean> {
  if (isEmailConfigured()) return true
  const count = await prisma.orgEmailSettings.count({ where: { orgId } })
  return count > 0
}

export interface EmailAttachment {
  filename: string
  content: Buffer
}

/**
 * Odešle e-mail „za firmu": přes SMTP organizace, pokud je nastavené,
 * jinak fallback na globální SMTP_* z .env. Bez obojího vyhodí chybu —
 * volající má předem kontrolovat isOrgEmailConfigured().
 */
export async function sendOrgEmail(
  orgId: string,
  to: string,
  subject: string,
  html: string,
  attachments?: EmailAttachment[]
) {
  const cfg = await getOrgSmtpConfig(orgId)
  if (cfg) {
    await orgTransporter(cfg).sendMail({ from: orgFromHeader(cfg), to, subject, html, attachments })
    return
  }
  if (!isEmailConfigured()) {
    throw new Error('Odesílání e-mailů není nastaveno (org SMTP ani globální SMTP_HOST)')
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? 'FELUCIA CRM <noreply@felucia.io>',
    to,
    subject,
    html,
    attachments,
  })
}

function emailLayout(content: string) {
  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FELUCIA CRM</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1A2744;padding:24px 32px;text-align:center;">
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <div style="background:#FFC93C;border-radius:8px;width:36px;height:36px;display:inline-block;vertical-align:middle;text-align:center;line-height:36px;">
                <span style="font-size:18px;font-weight:900;color:#1A2744;">F</span>
              </div>
              <span style="color:#fff;font-size:20px;font-weight:700;vertical-align:middle;margin-left:8px;">FELUCIA CRM</span>
            </div>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:32px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fc;padding:20px 32px;text-align:center;border-top:1px solid #e8ecf4;">
            <p style="margin:0;color:#9aa3b2;font-size:12px;">
              Tento email byl odeslán automaticky systémem FELUCIA CRM.<br/>
              Pokud jste tuto akci neprovedli, ignorujte tento email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function emailResetPassword(jmeno: string, url: string) {
  return emailLayout(`
    <h2 style="margin:0 0 8px;color:#1A2744;font-size:22px;">Obnova hesla</h2>
    <p style="color:#6b7280;margin:0 0 24px;">Dobrý den, <strong>${jmeno}</strong>.</p>
    <p style="color:#374151;margin:0 0 24px;">Obdrželi jsme žádost o obnovu hesla pro váš účet. Klikněte na tlačítko níže pro nastavení nového hesla.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${url}" style="display:inline-block;background:#FFC93C;color:#1A2744;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">
        Nastavit nové heslo
      </a>
    </div>
    <p style="color:#9aa3b2;font-size:13px;margin:0;">Odkaz je platný <strong>1 hodinu</strong>. Pokud jste obnovu hesla nepožadovali, tento email ignorujte.</p>
  `)
}

export function emailMagicLink(jmeno: string, url: string) {
  return emailLayout(`
    <h2 style="margin:0 0 8px;color:#1A2744;font-size:22px;">Přihlásit se do FELUCIA CRM</h2>
    <p style="color:#6b7280;margin:0 0 24px;">Dobrý den, <strong>${jmeno}</strong>.</p>
    <p style="color:#374151;margin:0 0 24px;">Kliknutím na tlačítko níže se okamžitě přihlásíte do systému — bez zadání hesla.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${url}" style="display:inline-block;background:#FFC93C;color:#1A2744;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">
        Přihlásit se do CRM
      </a>
    </div>
    <p style="color:#9aa3b2;font-size:13px;margin:0;">Odkaz je platný <strong>15 minut</strong> a lze jej použít pouze jednou.</p>
  `)
}

export function emailWelcome(jmeno: string, slug: string, loginUrl: string) {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'
  return emailLayout(`
    <h2 style="margin:0 0 8px;color:#1A2744;font-size:22px;">Vítejte v FELUCIA CRM! 🎉</h2>
    <p style="color:#6b7280;margin:0 0 24px;">Dobrý den, <strong>${jmeno}</strong>.</p>
    <p style="color:#374151;margin:0 0 16px;">Váš účet byl úspěšně vytvořen a je připraven k použití.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fc;border-radius:10px;margin:0 0 24px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 6px;color:#9aa3b2;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Vaše subdoména</p>
          <p style="margin:0;color:#1A2744;font-size:16px;font-weight:700;">${slug}.${rootDomain}</p>
        </td>
      </tr>
    </table>
    <div style="text-align:center;margin:32px 0;">
      <a href="${loginUrl}" style="display:inline-block;background:#FFC93C;color:#1A2744;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">
        Přihlásit se do CRM
      </a>
    </div>
    <p style="color:#374151;margin:0 0 8px;">Co dělat jako první:</p>
    <ul style="color:#374151;margin:0 0 24px;padding-left:20px;line-height:1.8;">
      <li>Importujte produktový katalog</li>
      <li>Přidejte členy týmu</li>
      <li>Vytvořte první obchodní případ</li>
    </ul>
    <p style="color:#9aa3b2;font-size:13px;margin:0;">
      Potřebujete pomoc? Napište nám na
      <a href="mailto:info@felucia.io" style="color:#FFC93C;">info@felucia.io</a>
    </p>
  `)
}

// ─── Zakázky email stubs (prepared for future SendGrid/Resend integration) ────

export async function sendPredavakEmail(predavakId: string, recipientEmail: string): Promise<void> {
  // TODO: integrate with SendGrid/Resend
  console.log(`[Email připraven k odeslání] Předávací protokol ${predavakId} → ${recipientEmail}`)
}

export async function sendVyuctovaniEmail(vyuctovaniId: string, recipientEmail: string): Promise<void> {
  // TODO: integrate with SendGrid/Resend
  console.log(`[Email připraven k odeslání] Vyúčtování ${vyuctovaniId} → ${recipientEmail}`)
}

// ─────────────────────────────────────────────────────────────────────────────

export function emailActivityReminder(jmeno: string, aktivita: string, dealLabel: string, termin: string, url: string) {
  return emailLayout(`
    <h2 style="margin:0 0 8px;color:#1A2744;font-size:22px;">⏰ Připomínka aktivity</h2>
    <p style="color:#6b7280;margin:0 0 24px;">Dobrý den, <strong>${jmeno}</strong>.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fc;border-radius:10px;margin:0 0 24px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 6px;color:#9aa3b2;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Aktivita</p>
          <p style="margin:0 0 12px;color:#1A2744;font-size:16px;font-weight:700;">${aktivita}</p>
          <p style="margin:0 0 6px;color:#9aa3b2;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Obchodní případ</p>
          <p style="margin:0 0 12px;color:#1A2744;font-size:14px;">${dealLabel}</p>
          <p style="margin:0 0 6px;color:#9aa3b2;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Termín</p>
          <p style="margin:0;color:#1A2744;font-size:14px;">${termin}</p>
        </td>
      </tr>
    </table>
    <div style="text-align:center;margin:32px 0;">
      <a href="${url}" style="display:inline-block;background:#FFC93C;color:#1A2744;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">
        Otevřít v CRM
      </a>
    </div>
  `)
}

// ─── E-maily klientům (branding organizace, ne Felucia) ─────────────────────

function orgEmailLayout(orgNazev: string, primaryColor: string, content: string) {
  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">
        <tr>
          <td style="padding:24px 32px;border-bottom:3px solid ${primaryColor};">
            <span style="color:#1a1a2e;font-size:19px;font-weight:700;">${orgNazev}</span>
          </td>
        </tr>
        <tr><td style="padding:32px;">${content}</td></tr>
        <tr>
          <td style="background:#f8f9fc;padding:18px 32px;text-align:center;border-top:1px solid #e8ecf4;">
            <p style="margin:0;color:#9aa3b2;font-size:12px;">Tento e-mail byl odeslán automaticky. Pokud vám nepatří, ignorujte ho.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function emailPodpisSmlouvy(params: {
  orgNazev: string
  primaryColor: string
  klientJmeno: string
  cisloSmlouvy: string
  url: string
  platnostDni: number
}) {
  const { orgNazev, primaryColor, klientJmeno, cisloSmlouvy, url, platnostDni } = params
  return orgEmailLayout(orgNazev, primaryColor, `
    <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:21px;">Smlouva k podpisu</h2>
    <p style="color:#6b7280;margin:0 0 24px;">Dobrý den, <strong>${klientJmeno}</strong>.</p>
    <p style="color:#374151;margin:0 0 8px;">Společnost <strong>${orgNazev}</strong> vám zasílá smlouvu
    <strong>č. ${cisloSmlouvy}</strong> k elektronickému podpisu.</p>
    <p style="color:#374151;margin:0 0 24px;">Po kliknutí na tlačítko vám na váš telefon přijde ověřovací kód —
    po jeho zadání si smlouvu přečtete a podepíšete přímo v telefonu nebo počítači. Zabere to jen pár minut.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${url}" style="display:inline-block;background:${primaryColor};color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">
        Zobrazit a podepsat smlouvu
      </a>
    </div>
    <p style="color:#9aa3b2;font-size:13px;margin:0;">Odkaz je platný <strong>${platnostDni} dní</strong> a je určen jen vám.
    Máte-li ke smlouvě dotaz nebo výhradu, kontaktujte nás — rádi ji upravíme.</p>
  `)
}

export function emailSmlouvaPodepsana(params: {
  orgNazev: string
  primaryColor: string
  jmeno: string
  cisloSmlouvy: string
}) {
  const { orgNazev, primaryColor, jmeno, cisloSmlouvy } = params
  return orgEmailLayout(orgNazev, primaryColor, `
    <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:21px;">Smlouva podepsána ✓</h2>
    <p style="color:#6b7280;margin:0 0 24px;">Dobrý den, <strong>${jmeno}</strong>.</p>
    <p style="color:#374151;margin:0 0 12px;">Smlouva <strong>č. ${cisloSmlouvy}</strong> byla úspěšně elektronicky podepsána.</p>
    <p style="color:#374151;margin:0 0 24px;">Podepsané vyhotovení najdete v příloze tohoto e-mailu. Doporučujeme si ho uložit.</p>
  `)
}

export function emailPasswordChanged(jmeno: string) {
  return emailLayout(`
    <h2 style="margin:0 0 8px;color:#1A2744;font-size:22px;">Heslo bylo změněno</h2>
    <p style="color:#374151;margin:0 0 24px;">Dobrý den, <strong>${jmeno}</strong>.</p>
    <p style="color:#374151;margin:0 0 24px;">Heslo k vašemu účtu bylo úspěšně změněno.</p>
    <p style="color:#9aa3b2;font-size:13px;">Pokud jste tuto změnu neprovedli, kontaktujte neprodleně administrátora systému.</p>
  `)
}
