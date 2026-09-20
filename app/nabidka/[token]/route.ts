import { NextRequest, NextResponse } from 'next/server'
import { loadQuoteByShareToken } from '@/lib/quoteShare'
import { renderQuotePdf } from '@/lib/quoteRenderer'
import { buildPdfFilename } from '@/lib/quoteKod'
import { getClientIp, checkRateLimit } from '@/lib/rateLimit'

// Veřejné zobrazení PDF nabídky klientem (odkaz sdílený obchodníkem).
// Token ověřujeme přes SHA-256 hash, odkaz má omezenou platnost.

function htmlNotFound() {
  return new NextResponse(
    `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Nabídka nenalezena</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f6fb;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<div style="background:#fff;border-radius:16px;padding:40px 32px;max-width:420px;text-align:center;box-shadow:0 2px 16px rgba(0,0,0,.08);margin:20px;">
<div style="font-size:40px;margin-bottom:12px;">📄</div>
<h1 style="font-size:19px;margin:0 0 8px;color:#1a1a2e;">Odkaz na nabídku už není platný</h1>
<p style="color:#6b7280;font-size:14px;margin:0;">Platnost odkazu vypršela, nebo byl zrušen. Ozvěte se prosím svému obchodníkovi — rád vám pošle nový.</p>
</div></body></html>`,
    { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const ip = getClientIp(req) // x-real-ip z nginx — XFF si klient může podvrhnout
  if (checkRateLimit(`nabidka-pdf:${ip}`, 20, 3600_000).limited) {
    return new NextResponse('Příliš mnoho požadavků', { status: 429 })
  }

  const share = await loadQuoteByShareToken(params.token)
  if (!share) return htmlNotFound()

  try {
    const pdf = await renderQuotePdf(share.quoteId, share.orgId, share.orgPlan)
    const filename = buildPdfFilename({
      clientJmeno: share.clientJmeno,
      clientPrijmeni: share.clientPrijmeni,
      quoteKod: share.kod,
      dealKod: share.dealKod,
      technologie: share.technologie,
    })
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex',
      },
    })
  } catch (err) {
    console.error('[nabidka-share] PDF error:', err)
    return new NextResponse('Chyba při generování nabídky', { status: 500 })
  }
}
