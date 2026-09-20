import { NextRequest, NextResponse } from 'next/server'
import { loadRelaceByToken, verifyPodpisCookie, podpisCookieName } from '@/lib/sodPodpis'
import { buildSodPdf } from '@/lib/sodPdf'
import { getClientIp, checkRateLimit } from '@/lib/rateLimit'

// Stažení podepsaného PDF klientem hned po podpisu. Vyžaduje OTP cookie
// (platí 2 h od ověření) — samotný odkaz z e-mailu na stažení nestačí.
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const ip = getClientIp(req) // x-real-ip z nginx — XFF si klient může podvrhnout
  if (checkRateLimit(`podpis-pdf:${ip}`, 10, 3600_000).limited) {
    return NextResponse.json({ error: 'Příliš mnoho požadavků' }, { status: 429 })
  }

  const relace = await loadRelaceByToken(params.token)
  if (!relace || relace.sod.stav !== 'PODEPSANO' || relace.stav !== 'PODEPSANA') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const cookie = req.cookies.get(podpisCookieName(relace.id))?.value
  if (!verifyPodpisCookie(relace.id, cookie)) {
    return NextResponse.json({ error: 'Ověření vypršelo — podepsané PDF vám přišlo e-mailem' }, { status: 401 })
  }

  const result = await buildSodPdf(relace.sodId, relace.orgId)
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return new NextResponse(result.pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.cislo}-podepsana.pdf"`,
    },
  })
}
