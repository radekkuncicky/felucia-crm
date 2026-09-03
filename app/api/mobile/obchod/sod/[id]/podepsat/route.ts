import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { generateToken, sha256, logSodUdalost } from '@/lib/sodPodpis'
import { buildSodContentHtml } from '@/lib/sodHtml'
import { buildSodPdf } from '@/lib/sodPdf'
import { prevedDealNaUspechPoPodpisu } from '@/lib/dealUspech'
import { sendOrgEmail, emailSmlouvaPodepsana } from '@/lib/email'
import { getOrgSettings } from '@/lib/orgSettings'
import { createNotification } from '@/lib/createNotification'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/mobile/obchod/sod/[id]/podepsat — podpis klienta NA MÍSTĚ
 * (klient podepíše obchodníkovi na telefonu; identitu ověřil obchodník osobně,
 * OTP se nepoužívá). { podpisSvg, jmeno, souhlas } — podpisSvg je PNG data URL
 * nebo surové SVG ze SignaturePadu (uloží se jako svg+xml data URL).
 * Vznikne snapshot verze + relace PODEPSANA (stejně jako u podpisu na dálku,
 * jen bez odkazu), OP přejde na USPECH a založí se zakázka.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)

  const sod = await db.sod.findFirst({
    where: { id: params.id },
    include: {
      organization: {
        select: { nazev: true, sidlo: true, ico: true, dic: true, email: true, telefon: true },
      },
    },
  })
  if (!sod) return NextResponse.json({ error: 'Smlouva nenalezena' }, { status: 404 })
  if (sod.stav === 'PODEPSANO') {
    return NextResponse.json({ error: 'Smlouva už je podepsaná' }, { status: 422 })
  }
  if (sod.stav === 'STORNO') {
    return NextResponse.json({ error: 'Stornovanou smlouvu nelze podepsat' }, { status: 422 })
  }

  const body = await req.json().catch(() => ({}))
  const jmeno = String(body.jmeno ?? '').trim()
  const souhlas = body.souhlas === true
  let podpis = typeof body.podpisSvg === 'string' ? body.podpisSvg.trim() : ''

  if (!souhlas) return NextResponse.json({ error: 'Klient musí potvrdit souhlas se zněním smlouvy' }, { status: 422 })
  if (!jmeno) return NextResponse.json({ error: 'Vyplňte jméno podepisujícího' }, { status: 422 })

  // SignaturePad v appce vrací surové SVG — normalizace na data URL
  if (/^<svg[\s>]/.test(podpis)) {
    podpis = `data:image/svg+xml;base64,${Buffer.from(podpis, 'utf8').toString('base64')}`
  }
  if (!/^data:image\/(png|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(podpis) || podpis.length > 500_000) {
    return NextResponse.json({ error: 'Podpis se nepodařilo načíst, zkuste to znovu' }, { status: 422 })
  }

  // Snapshot přesně toho, co klient na telefonu viděl a podepsal
  const contentHtml = buildSodContentHtml(sod)
  const textHash = sha256(contentHtml)
  const podepsano = new Date()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null

  await db.$transaction(async tx => {
    // Případný odkaz na dálku přestává platit — podepsáno osobně
    await tx.sodPodpisRelace.updateMany({
      where: { sodId: sod.id, stav: 'AKTIVNI' },
      data: { stav: 'ZNEPLATNENA' },
    })
    const posledni = await tx.sodVerze.findFirst({
      where: { sodId: sod.id },
      orderBy: { cislo: 'desc' },
      select: { cislo: true },
    })
    const verze = await tx.sodVerze.create({
      data: {
        orgId,
        sodId: sod.id,
        cislo: (posledni?.cislo ?? 0) + 1,
        textSmlouvy: contentHtml,
        vytvorilId: userId,
      },
    })
    // Relace PODEPSANA drží verzi podepsaného textu (token nikam neodchází)
    await tx.sodPodpisRelace.create({
      data: {
        orgId,
        sodId: sod.id,
        verzeId: verze.id,
        stav: 'PODEPSANA',
        tokenHash: sha256(generateToken()),
        email: sod.klientEmail ?? '',
        telefon: sod.klientTelefon ?? '',
        expirace: podepsano,
        odeslalId: userId,
      },
    })
    await tx.sod.update({
      where: { id: sod.id },
      data: {
        stav: 'PODEPSANO',
        podpisSvg: podpis,
        podepsano,
        podepsalJmeno: jmeno,
        podpisIp: ip,
        podpisUserAgent: userAgent,
        podpisTextHash: textHash,
      },
    })
  })
  await logSodUdalost({
    orgId, sodId: sod.id, typ: 'PODEPSANO',
    userId, meta: { jmeno, textHash, naMiste: true }, req,
  })

  // OP → USPECH + zakázka (podepsaná smlouva = vyhráno)
  const uspech = await prevedDealNaUspechPoPodpisu({ orgId, dealId: sod.dealId, userId })

  // Vlastník OP dostane zvonek, když podepsal někdo jiný
  const deal = await db.deal.findFirst({ where: { id: sod.dealId }, select: { userId: true } })
  if (deal?.userId && deal.userId !== userId) {
    await createNotification({
      orgId,
      userId: deal.userId,
      typ: 'SOD_PODEPSANA',
      zprava: `Klient ${jmeno} podepsal smlouvu ${sod.cislo} na místě`,
      dealId: sod.dealId,
      url: `/sod/${sod.id}`,
    })
  }

  // Podepsané PDF klientovi (má-li e-mail) a firmě — selhání podpis neruší
  try {
    const result = await buildSodPdf(sod.id, orgId)
    if (result) {
      const settings = await getOrgSettings(orgId)
      const attachment = { filename: `${result.cislo}-podepsana.pdf`, content: result.pdf }
      const brand = { orgNazev: sod.organization.nazev, primaryColor: settings.primaryColor, cisloSmlouvy: result.cislo }

      if (sod.klientEmail) {
        await sendOrgEmail(
          orgId, sod.klientEmail,
          `Podepsaná smlouva č. ${result.cislo} — ${sod.organization.nazev}`,
          emailSmlouvaPodepsana({ ...brand, jmeno }),
          [attachment]
        ).catch(() => {})
      }
      const obchodnik = await prisma.user.findFirst({
        where: { id: userId, orgId }, select: { email: true, jmeno: true },
      })
      const firemniEmail = obchodnik?.email ?? sod.organization.email
      if (firemniEmail) {
        await sendOrgEmail(
          orgId, firemniEmail,
          `Klient podepsal smlouvu č. ${result.cislo}`,
          emailSmlouvaPodepsana({ ...brand, jmeno: obchodnik?.jmeno ?? sod.organization.nazev }),
          [attachment]
        ).catch(() => {})
      }
    }
  } catch { /* PDF/e-mail selhal — podpis platí, dokument je v CRM */ }

  return NextResponse.json({
    ok: true,
    stav: 'PODEPSANO',
    podepsano,
    dealStav: uspech.zmeneno ? 'USPECH' : undefined,
    zakazkaId: uspech.zakazkaId,
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
