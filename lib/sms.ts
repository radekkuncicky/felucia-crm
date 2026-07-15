/**
 * SMS brána pro OTP kódy online podpisu smluv. Bez nakonfigurovaného
 * providera je odesílání vypnuté (isSmsConfigured() — stejný princip jako
 * SMTP/Sentry) a „Odeslat k podpisu" je v UI nedostupné.
 *
 * Aktivace v .env:
 *   SMS_PROVIDER=smsmanager + SMSMANAGER_APIKEY (REST API klíč z administrace smsmanager.cz)
 *   SMS_PROVIDER=smsbrana   + SMSBRANA_LOGIN, SMSBRANA_PASSWORD
 *   SMS_PROVIDER=gosms      + GOSMS_CLIENT_ID, GOSMS_CLIENT_SECRET, GOSMS_CHANNEL
 */

export function isSmsConfigured(): boolean {
  const p = process.env.SMS_PROVIDER
  if (p === 'smsmanager') return !!process.env.SMSMANAGER_APIKEY
  if (p === 'smsbrana') return !!(process.env.SMSBRANA_LOGIN && process.env.SMSBRANA_PASSWORD)
  if (p === 'gosms') return !!(process.env.GOSMS_CLIENT_ID && process.env.GOSMS_CLIENT_SECRET && process.env.GOSMS_CHANNEL)
  return false
}

/** +420601123456 / 601 123 456 → 420601123456; null = nevalidní české číslo */
export function normalizeTelefon(telefon: string): string | null {
  const digits = telefon.replace(/[\s\-()]/g, '').replace(/^\+/, '').replace(/^00/, '')
  if (/^420\d{9}$/.test(digits)) return digits
  if (/^\d{9}$/.test(digits)) return `420${digits}`
  return null
}

/** 420601123456 → +420 ••• ••• 456 (pro zobrazení na veřejné stránce) */
export function maskTelefon(normalized: string): string {
  return `+${normalized.slice(0, 3)} ••• ••• ${normalized.slice(-3)}`
}

async function sendViaSmsmanager(number: string, message: string): Promise<void> {
  const res = await fetch('https://api.smsmngr.com/v2/message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.SMSMANAGER_APIKEY!,
    },
    body: JSON.stringify({ body: message, to: [{ phone_number: `+${number}` }] }),
    signal: AbortSignal.timeout(15_000),
  })
  const data = await res.json().catch(() => null)
  // Úspěch = zpráva přijata bránou: accepted obsahuje záznam, rejected je prázdné
  const accepted = Array.isArray(data?.accepted) && data.accepted.length > 0
  if (!res.ok || !accepted) {
    throw new Error(`SMSmanager: odeslání selhalo (${res.status}: ${JSON.stringify(data)?.slice(0, 160)})`)
  }
}

async function sendViaSmsbrana(number: string, message: string): Promise<void> {
  const params = new URLSearchParams({
    action: 'send_sms',
    login: process.env.SMSBRANA_LOGIN!,
    password: process.env.SMSBRANA_PASSWORD!,
    number,
    message,
  })
  const res = await fetch(`https://api.smsbrana.cz/smsconnect/http.php?${params}`, {
    signal: AbortSignal.timeout(15_000),
  })
  const text = await res.text()
  // SMSbrána vrací XML; <err>N</err> s N > 0 značí chybu
  const err = text.match(/<err>(\d+)<\/err>/)
  if (!res.ok || (err && err[1] !== '0')) {
    throw new Error(`SMSbrána: odeslání selhalo (err ${err?.[1] ?? res.status})`)
  }
}

async function sendViaGosms(number: string, message: string): Promise<void> {
  const tokenRes = await fetch('https://app.gosms.cz/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.GOSMS_CLIENT_ID!,
      client_secret: process.env.GOSMS_CLIENT_SECRET!,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!tokenRes.ok) throw new Error(`GoSMS: získání tokenu selhalo (${tokenRes.status})`)
  const { access_token } = await tokenRes.json()

  const res = await fetch('https://app.gosms.cz/api/v1/messages/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${access_token}`,
    },
    body: JSON.stringify({
      message,
      recipients: `+${number}`,
      channel: Number(process.env.GOSMS_CHANNEL),
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`GoSMS: odeslání selhalo (${res.status})`)
}

/**
 * Odešle SMS na normalizované číslo (420XXXXXXXXX). Vyhazuje chybu při
 * selhání i při chybějící konfiguraci — volající kontroluje isSmsConfigured().
 */
export async function sendSms(normalizedNumber: string, message: string): Promise<void> {
  const provider = process.env.SMS_PROVIDER
  if (provider === 'smsmanager') return sendViaSmsmanager(normalizedNumber, message)
  if (provider === 'smsbrana') return sendViaSmsbrana(normalizedNumber, message)
  if (provider === 'gosms') return sendViaGosms(normalizedNumber, message)
  throw new Error('SMS brána není nakonfigurována (SMS_PROVIDER v .env)')
}
