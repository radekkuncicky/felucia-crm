import crypto from 'crypto'
import { SodUdalostTyp } from '@prisma/client'
import { prisma } from './prisma'
import { orgPrisma } from './orgPrisma'
import { formatDate } from './format'

/**
 * Helpery online podpisu smluv: tokeny podpisových relací, OTP kódy,
 * ověřovací cookie po OTP a podpisový blok do HTML/PDF.
 *
 * Token i OTP se v DB drží jen jako otisk. Ověření OTP vydá krátkodobou
 * HMAC cookie vázanou na relaci — ten, kdo jen zná odkaz, smlouvu neuvidí.
 */

export const PODPIS_RELACE_DNI = 30 // platnost odkazu
export const OTP_PLATNOST_MIN = 10
export const OTP_MAX_POKUSU = 5
export const PODPIS_COOKIE_HODIN = 2

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET
  if (!s) throw new Error('NEXTAUTH_SECRET není nastaven')
  return s
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

/** HMAC místo prostého hashe — 6místný OTP by šel offline dopočítat */
export function otpHash(kod: string, relaceId: string): string {
  return crypto.createHmac('sha256', secret()).update(`otp:${relaceId}:${kod}`).digest('hex')
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
}

// ── Ověřovací cookie po úspěšném OTP ─────────────────────────────────────────

export function podpisCookieName(relaceId: string): string {
  return `podpis_overeno_${relaceId}`
}

export function makePodpisCookie(relaceId: string): { value: string; maxAge: number } {
  const exp = Date.now() + PODPIS_COOKIE_HODIN * 3600_000
  const payload = `${relaceId}.${exp}`
  const sig = crypto.createHmac('sha256', secret()).update(`cookie:${payload}`).digest('base64url')
  return { value: `${payload}.${sig}`, maxAge: PODPIS_COOKIE_HODIN * 3600 }
}

export function verifyPodpisCookie(relaceId: string, value: string | undefined): boolean {
  if (!value) return false
  const parts = value.split('.')
  if (parts.length !== 3) return false
  const [rid, expStr, sig] = parts
  if (rid !== relaceId) return false
  if (Number(expStr) < Date.now()) return false
  const expected = crypto.createHmac('sha256', secret()).update(`cookie:${rid}.${expStr}`).digest('base64url')
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
}

// ── Načtení relace na veřejné routě ─────────────────────────────────────────

/**
 * Najde podpisovou relaci podle tokenu z URL. Bare prisma záměrně — org
 * je před resolvnutím tokenu neznámá (stejný vzor jako webhooky); token
 * o 32 náhodných bytech je sám o sobě autorizace k nalezení relace.
 * Prošlou aktivní relaci líně označí a smlouvu vrátí do EXPIROVÁNO.
 */
export async function loadRelaceByToken(token: string) {
  if (!token || token.length < 20 || token.length > 100) return null
  const relace = await prisma.sodPodpisRelace.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      sod: {
        include: {
          organization: {
            select: { nazev: true, email: true, telefon: true, logo: true, slug: true },
          },
        },
      },
    },
  })
  if (!relace) return null

  if (relace.stav === 'AKTIVNI' && relace.expirace < new Date()) {
    const db = orgPrisma(relace.orgId)
    await db.sodPodpisRelace.update({ where: { id: relace.id }, data: { stav: 'EXPIROVANA' } })
    if (relace.sod.stav === 'ODESLANO') {
      await db.sod.update({ where: { id: relace.sodId }, data: { stav: 'EXPIROVANO' } })
    }
    await logSodUdalost({ orgId: relace.orgId, sodId: relace.sodId, typ: 'EXPIROVANO', relaceId: relace.id })
    relace.stav = 'EXPIROVANA'
  }
  return relace
}

// ── Audit události ───────────────────────────────────────────────────────────

export async function logSodUdalost(params: {
  orgId: string
  sodId: string
  typ: SodUdalostTyp
  relaceId?: string
  userId?: string
  meta?: Record<string, unknown>
  req?: Request
}) {
  const { orgId, sodId, typ, relaceId, userId, meta, req } = params
  const ip = req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = req?.headers.get('user-agent')?.slice(0, 500) ?? null
  try {
    await orgPrisma(orgId).sodUdalost.create({
      data: { orgId, sodId, typ, relaceId, userId, meta: meta as never, ip, userAgent },
    })
  } catch {
    // audit nesmí shodit hlavní akci
  }
}

// ── Podpisový blok do zobrazení smlouvy a PDF ───────────────────────────────

export function sodPodpisBlockHtml(sod: {
  podpisSvg: string | null // PNG data URL ze SignatureCanvas (název dle předáváků)
  podepsano: Date | null
  podepsalJmeno: string | null
  podpisTextHash: string | null
}): string {
  if (!sod.podpisSvg || !sod.podepsano) return ''
  if (!sod.podpisSvg.startsWith('data:image/')) return ''
  const svgDataUrl = sod.podpisSvg
  return `
<div style="margin-top:32px;padding:16px 20px;border:1.5px solid #16a34a;border-radius:8px;page-break-inside:avoid;">
  <p style="margin:0 0 2px;font-size:9pt;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.06em;">Podepsáno elektronicky objednatelem</p>
  <img src="${svgDataUrl}" alt="podpis" style="height:64px;max-width:260px;display:block;margin:8px 0 4px;" />
  <p style="margin:0;font-size:10pt;font-weight:700;">${sod.podepsalJmeno ?? ''}</p>
  <p style="margin:2px 0 0;font-size:9pt;color:#555;">Datum podpisu: ${formatDate(sod.podepsano)}</p>
  ${sod.podpisTextHash ? `<p style="margin:6px 0 0;font-size:7.5pt;color:#999;font-family:monospace;">Otisk dokumentu (SHA-256): ${sod.podpisTextHash}</p>` : ''}
</div>`
}

/** Vloží podpisový blok před </body>, případně na konec dokumentu */
export function appendPodpisBlock(html: string, block: string): string {
  if (!block) return html
  const idx = html.lastIndexOf('</body>')
  if (idx === -1) return html + block
  return html.slice(0, idx) + block + html.slice(idx)
}
