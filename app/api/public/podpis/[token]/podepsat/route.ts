import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { orgPrisma } from '@/lib/orgPrisma'
import {
  loadRelaceByToken, verifyPodpisCookie, podpisCookieName, sha256, logSodUdalost,
} from '@/lib/sodPodpis'
import { checkRateLimit } from '@/lib/rateLimit'
import { createNotification } from '@/lib/createNotification'
import { sendOrgEmail, emailSmlouvaPodepsana } from '@/lib/email'
import { getOrgSettings } from '@/lib/orgSettings'
import { buildSodPdf } from '@/lib/sodPdf'

// Vlastní podpis: vyžaduje platnou OTP cookie. Uloží podpis + audit
// (IP, user-agent, SHA-256 otisk podepsané verze), pošle podepsané PDF
// klientovi i firmě a upozorní obchodníka.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (checkRateLimit(`podpis-sign:${ip}`, 10, 3600_000).limited) {
    return NextResponse.json({ error: 'Příliš mnoho požadavků' }, { status: 429 })
  }

  const relace = await loadRelaceByToken(params.token)
  if (!relace || relace.stav !== 'AKTIVNI') {
    return NextResponse.json({ error: 'Odkaz už není platný' }, { status: 404 })
  }
  if (relace.sod.stav === 'PODEPSANO') {
    return NextResponse.json({ error: 'Smlouva už je podepsaná' }, { status: 422 })
  }
  const cookie = req.cookies.get(podpisCookieName(relace.id))?.value
  if (!verifyPodpisCookie(relace.id, cookie)) {
    return NextResponse.json({ error: 'Ověření vypršelo — obnovte stránku a ověřte se znovu' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const podpisSvg = typeof body.podpisSvg === 'string' ? body.podpisSvg : ''
  const jmeno = String(body.jmeno ?? '').trim()
  const souhlas = body.souhlas === true

  if (!souhlas) return NextResponse.json({ error: 'Potvrďte prosím souhlas se zněním smlouvy' }, { status: 422 })
  if (!jmeno) return NextResponse.json({ error: 'Vyplňte prosím své jméno' }, { status: 422 })
  // SignatureCanvas vrací PNG data URL (pole podpisSvg dle konvence předáváků)
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(podpisSvg) || podpisSvg.length > 500_000) {
    return NextResponse.json({ error: 'Podpis se nepodařilo načíst, zkuste to znovu' }, { status: 422 })
  }

  const db = orgPrisma(relace.orgId)
  const verze = relace.verzeId
    ? await db.sodVerze.findFirst({ where: { id: relace.verzeId, orgId: relace.orgId } })
    : null
  const textHash = verze ? sha256(verze.textSmlouvy) : null
  const podepsano = new Date()
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null

  await db.$transaction(async tx => {
    await tx.sod.update({
      where: { id: relace.sodId },
      data: {
        stav: 'PODEPSANO',
        podpisSvg,
        podepsano,
        podepsalJmeno: jmeno,
        podpisIp: ip,
        podpisUserAgent: userAgent,
        podpisTextHash: textHash,
      },
    })
    await tx.sodPodpisRelace.update({
      where: { id: relace.id },
      data: { stav: 'PODEPSANA' },
    })
  })
  await logSodUdalost({
    orgId: relace.orgId, sodId: relace.sodId, typ: 'PODEPSANO', relaceId: relace.id,
    meta: { jmeno, textHash }, req,
  })

  // Upozornění obchodníkovi (bell) — nesmí shodit podpis
  if (relace.odeslalId) {
    await createNotification({
      orgId: relace.orgId,
      userId: relace.odeslalId,
      typ: 'SOD_PODEPSANA',
      zprava: `Klient ${jmeno} podepsal smlouvu ${relace.sod.cislo}`,
      dealId: relace.sod.dealId,
      url: `/sod/${relace.sodId}`,
    })
  }

  // Podepsané PDF oběma stranám — selhání podpis neruší (PDF zůstává v CRM)
  try {
    const result = await buildSodPdf(relace.sodId, relace.orgId)
    if (result) {
      const settings = await getOrgSettings(relace.orgId)
      const attachment = { filename: `${result.cislo}-podepsana.pdf`, content: result.pdf }
      const brand = { orgNazev: relace.sod.organization.nazev, primaryColor: settings.primaryColor, cisloSmlouvy: result.cislo }

      await sendOrgEmail(
        relace.orgId, relace.email,
        `Podepsaná smlouva č. ${result.cislo} — ${relace.sod.organization.nazev}`,
        emailSmlouvaPodepsana({ ...brand, jmeno }),
        [attachment]
      ).catch(() => {})

      const odeslal = relace.odeslalId
        ? await prisma.user.findFirst({ where: { id: relace.odeslalId, orgId: relace.orgId }, select: { email: true, jmeno: true } })
        : null
      const firemniEmail = odeslal?.email ?? relace.sod.organization.email
      if (firemniEmail) {
        await sendOrgEmail(
          relace.orgId, firemniEmail,
          `Klient podepsal smlouvu č. ${result.cislo}`,
          emailSmlouvaPodepsana({ ...brand, jmeno: odeslal?.jmeno ?? relace.sod.organization.nazev }),
          [attachment]
        ).catch(() => {})
      }
    }
  } catch { /* PDF/e-mail selhal — podpis platí, dokument je v CRM */ }

  return NextResponse.json({ ok: true, podepsano })
}
