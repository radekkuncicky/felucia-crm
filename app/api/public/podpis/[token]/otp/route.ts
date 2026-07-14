import { NextRequest, NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { isSmsConfigured, sendSms, maskTelefon } from '@/lib/sms'
import {
  loadRelaceByToken, generateOtp, otpHash, logSodUdalost, OTP_PLATNOST_MIN,
} from '@/lib/sodPodpis'
import { checkRateLimit } from '@/lib/rateLimit'

// Odeslání OTP kódu SMS — až na explicitní akci klienta na stránce.
// (Kdyby SMS odcházela při otevření odkazu, spouštěly by ji e-mailové skenery.)
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (checkRateLimit(`podpis-otp-ip:${ip}`, 10, 3600_000).limited) {
    return NextResponse.json({ error: 'Příliš mnoho požadavků, zkuste to později' }, { status: 429 })
  }

  const relace = await loadRelaceByToken(params.token)
  if (!relace || relace.stav !== 'AKTIVNI' || relace.sod.stav === 'PODEPSANO') {
    return NextResponse.json({ error: 'Odkaz už není platný' }, { status: 404 })
  }
  if (!isSmsConfigured()) {
    return NextResponse.json({ error: 'Ověření SMS kódem je dočasně nedostupné' }, { status: 503 })
  }
  if (checkRateLimit(`podpis-otp:${relace.id}`, 5, 3600_000).limited) {
    return NextResponse.json({ error: 'Příliš mnoho odeslaných kódů — zkuste to za hodinu' }, { status: 429 })
  }

  const kod = generateOtp()
  await orgPrisma(relace.orgId).sodPodpisRelace.update({
    where: { id: relace.id },
    data: {
      otpHash: otpHash(kod, relace.id),
      otpExpirace: new Date(Date.now() + OTP_PLATNOST_MIN * 60_000),
      otpPokusy: 0,
    },
  })

  try {
    await sendSms(
      relace.telefon,
      `Overovaci kod pro podpis smlouvy c. ${relace.sod.cislo}: ${kod}. Plati ${OTP_PLATNOST_MIN} minut.`
    )
  } catch {
    return NextResponse.json({ error: 'SMS se nepodařilo odeslat, zkuste to znovu' }, { status: 502 })
  }

  await logSodUdalost({ orgId: relace.orgId, sodId: relace.sodId, typ: 'OTP_ODESLAN', relaceId: relace.id, req })
  return NextResponse.json({ ok: true, maskTelefon: maskTelefon(relace.telefon), platnostMin: OTP_PLATNOST_MIN })
}
