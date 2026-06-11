import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

// SECURITY FIX: Escape HTML special characters to prevent XSS in email body
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function POST(req: Request) {
  // SECURITY FIX: Rate limit contact form — max 5 per hour per IP to prevent email spam
  const ip = getClientIp(req)
  const { limited } = checkRateLimit(`contact:${ip}`, 5, 60 * 60 * 1000)
  if (limited) {
    return NextResponse.json({ error: 'Příliš mnoho zpráv. Zkuste to za hodinu.' }, { status: 429 })
  }

  try {
    const { jmeno, email, zprava } = await req.json()
    if (!jmeno || !email || !zprava) {
      return NextResponse.json({ error: 'Chybí povinná pole' }, { status: 400 })
    }

    // SECURITY FIX: Enforce max length on user inputs to prevent oversized payloads
    if (String(jmeno).length > 200 || String(email).length > 200 || String(zprava).length > 5000) {
      return NextResponse.json({ error: 'Příliš dlouhý vstup' }, { status: 400 })
    }

    const safeJmeno = escapeHtml(String(jmeno))
    const safeEmail = escapeHtml(String(email))
    const safeZprava = escapeHtml(String(zprava))

    const html = `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#00D4C8;">Nová zpráva z felucia.io</h2>
        <p><strong>Jméno:</strong> ${safeJmeno}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Zpráva:</strong></p>
        <div style="background:#f4f6fb;border-radius:8px;padding:16px;white-space:pre-wrap;">${safeZprava}</div>
      </div>
    `

    await sendEmail('info@felucia.io', `Kontaktní formulář — ${safeJmeno}`, html)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Chyba při odesílání' }, { status: 500 })
  }
}
