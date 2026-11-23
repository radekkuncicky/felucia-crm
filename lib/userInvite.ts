import { issuePasswordResetToken } from './authTokens'
import { orgBaseUrl } from './authCookie'
import { prisma } from './prisma'
import { sendOrgEmail, isOrgEmailConfigured, emailPozvanka, emailResetOdSpravce } from './email'
import { ROLE_LABELS, isRoleName } from './permissions'

/**
 * Pozvánky a odkazy na heslo od správce. Odkaz se vždy vrací volajícímu (UI ho
 * ukáže ke zkopírování) — e-mail je jen doručovací kanál navíc. Když nedorazí
 * (chybí SMTP, spam/karanténa), admin pošle odkaz jinak (SMS, WhatsApp).
 */

export const POZVANKA_TTL_DNI = 7
export const RESET_OD_SPRAVCE_TTL_H = 24

type Db = Parameters<typeof issuePasswordResetToken>[0]

export interface OdkazVysledek {
  url: string
  emailSent: boolean
  emailError: string | null
}

const isTechnikRole = (role: string) => role === 'TECHNIK' || role === 'HLAVNI_TECHNIK'

async function odeslat(orgId: string, to: string, subject: string, html: string): Promise<{ emailSent: boolean; emailError: string | null }> {
  if (!(await isOrgEmailConfigured(orgId))) {
    return { emailSent: false, emailError: 'Odesílání e-mailů není nastavené — pošlete odkaz ručně.' }
  }
  try {
    await sendOrgEmail(orgId, to, subject, html)
    return { emailSent: true, emailError: null }
  } catch (err) {
    console.error('[userInvite] email error:', err)
    return { emailSent: false, emailError: 'E-mail se nepodařilo odeslat — pošlete odkaz ručně.' }
  }
}

/** Pozvánka: odkaz na nastavení hesla (7 dní) + e-mail s firmou, rolí a adresou CRM */
export async function posliPozvanku(db: Db, p: {
  orgId: string
  user: { id: string; email: string; jmeno: string; role: string }
  kdoZve?: string | null
}): Promise<OdkazVysledek> {
  const token = await issuePasswordResetToken(db, p.user.id, POZVANKA_TTL_DNI * 24 * 60 * 60 * 1000)
  const org = await prisma.organization.findUnique({ where: { id: p.orgId }, select: { slug: true, nazev: true } })
  const base = orgBaseUrl(org?.slug)
  const url = `${base}/reset-password?token=${token}&pozvanka=1`
  const technik = isTechnikRole(p.user.role)
  const html = emailPozvanka({
    jmeno: p.user.jmeno,
    orgNazev: org?.nazev ?? 'Felucia',
    kdoZve: p.kdoZve,
    roleLabel: isRoleName(p.user.role) ? ROLE_LABELS[p.user.role] : p.user.role,
    email: p.user.email,
    url,
    loginUrl: `${base}/auth/signin`,
    platnostDni: POZVANKA_TTL_DNI,
    appUrl: technik ? (process.env.FELUCIA_TECH_APP_URL || null) : null,
  })
  const subject = technik ? `Přístup do Felucia Tech – ${org?.nazev ?? 'Felucia'}` : `Pozvánka do ${org?.nazev ?? 'Felucia'}`
  return { url, ...(await odeslat(p.orgId, p.user.email, subject, html)) }
}

/** Odkaz na nové heslo od správce (24 h) — pro uživatele, kteří se už přihlásili */
export async function posliResetOdSpravce(db: Db, p: {
  orgId: string
  user: { id: string; email: string; jmeno: string }
  kdo?: string | null
}): Promise<OdkazVysledek> {
  const token = await issuePasswordResetToken(db, p.user.id, RESET_OD_SPRAVCE_TTL_H * 60 * 60 * 1000)
  const org = await prisma.organization.findUnique({ where: { id: p.orgId }, select: { slug: true, nazev: true } })
  const url = `${orgBaseUrl(org?.slug)}/reset-password?token=${token}`
  const html = emailResetOdSpravce({ jmeno: p.user.jmeno, orgNazev: org?.nazev ?? 'Felucia', kdo: p.kdo, url, platnostHodin: RESET_OD_SPRAVCE_TTL_H })
  return { url, ...(await odeslat(p.orgId, p.user.email, 'Nastavení nového hesla – Felucia', html)) }
}
