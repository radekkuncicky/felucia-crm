import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import {
  loadRelaceByToken, otpHash, logSodUdalost, makePodpisCookie, podpisCookieName, OTP_MAX_POKUSU,
} from '@/lib/sodPodpis'
import { getClientIp, checkRateLimit } from '@/lib/rateLimit'

// Ověření SMS kódu → krátkodobá HMAC cookie, která odemkne zobrazení a podpis
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const ip = getClientIp(req) // x-real-ip z nginx — XFF si klient může podvrhnout
  if (checkRateLimit(`podpis-overit:${ip}`, 30, 3600_000).limited) {
    return NextResponse.json({ error: 'Příliš mnoho pokusů, zkuste to později' }, { status: 429 })
  }

  const relace = await loadRelaceByToken(params.token)
  if (!relace || relace.stav !== 'AKTIVNI') {
    return NextResponse.json({ error: 'Odkaz už není platný' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const kod = String(body.kod ?? '').trim()
  if (!/^\d{6}$/.test(kod)) {
    return NextResponse.json({ error: 'Zadejte 6místný kód z SMS' }, { status: 422 })
  }

  if (relace.otpPokusy >= OTP_MAX_POKUSU) {
    return NextResponse.json({ error: 'Příliš mnoho chybných pokusů — nechte si poslat nový kód' }, { status: 423 })
  }
  if (!relace.otpHash || !relace.otpExpirace || relace.otpExpirace < new Date()) {
    return NextResponse.json({ error: 'Kód vypršel — nechte si poslat nový' }, { status: 422 })
  }

  const expected = Buffer.from(relace.otpHash)
  const actual = Buffer.from(otpHash(kod, relace.id))
  const ok = expected.length === actual.length && crypto.timingSafeEqual(expected, actual)

  const db = orgPrisma(relace.orgId)
  if (!ok) {
    const updated = await db.sodPodpisRelace.update({
      where: { id: relace.id },
      data: { otpPokusy: { increment: 1 } },
      select: { otpPokusy: true },
    })
    await logSodUdalost({ orgId: relace.orgId, sodId: relace.sodId, typ: 'OTP_CHYBA', relaceId: relace.id, req })
    const zbyva = Math.max(0, OTP_MAX_POKUSU - updated.otpPokusy)
    return NextResponse.json(
      { error: zbyva > 0 ? `Nesprávný kód (zbývá ${zbyva} pokusů)` : 'Příliš mnoho chybných pokusů — nechte si poslat nový kód' },
      { status: zbyva > 0 ? 401 : 423 }
    )
  }

  await db.sodPodpisRelace.update({
    where: { id: relace.id },
    data: { otpOvereno: new Date(), otpHash: null },
  })
  await logSodUdalost({ orgId: relace.orgId, sodId: relace.sodId, typ: 'OTP_OVERENO', relaceId: relace.id, req })

  const cookie = makePodpisCookie(relace.id)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(podpisCookieName(relace.id), cookie.value, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: cookie.maxAge,
    path: '/',
  })
  return res
}
