import { getServerSession } from 'next-auth'
import { canAccessQuote } from '@/lib/zakazkyHelpers'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { renderQuotePdf } from '@/lib/quoteRenderer'
import { buildPdfFilename } from '@/lib/quoteKod'
import { isOrgEmailConfigured, sendOrgEmail, emailCenovaNabidka } from '@/lib/email'
import { getOrgSettings } from '@/lib/orgSettings'
import { ensureQuoteShare, quoteShareUrl, QUOTE_SHARE_DNI } from '@/lib/quoteShare'
import { checkRateLimit } from '@/lib/rateLimit'
import { getPerms, forbidden } from '@/lib/permissions'

// Odeslání cenové nabídky klientovi: PDF v příloze + veřejný odkaz.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessQuote(session.user, getPerms(session.user), params.id))) return forbidden()
  if (!getPerms(session.user).obchod) return forbidden('Nedostatečná oprávnění')

  const { limited } = checkRateLimit(`quote-email:${session.user.id}`, 10, 3600_000)
  if (limited) return NextResponse.json({ error: 'Příliš mnoho odeslaných e-mailů, zkuste to později.' }, { status: 429 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  if (!(await isOrgEmailConfigured(orgId))) {
    return NextResponse.json({
      error: 'Odesílání e-mailů není nastaveno. Nastavte SMTP v Nastavení → E-mail.',
      code: 'EMAIL_NOT_CONFIGURED',
    }, { status: 400 })
  }

  const [quote, org, settings] = await Promise.all([
    db.quote.findFirst({
      where: { id: params.id, deal: { orgId } },
      select: {
        id: true,
        kod: true,
        deal: {
          select: {
            id: true,
            kod: true,
            technologie: true,
            client: { select: { jmeno: true, prijmeni: true, email: true } },
          },
        },
      },
    }),
    db.organization.findUnique({ where: { id: orgId }, select: { nazev: true, plan: true } }),
    getOrgSettings(orgId),
  ])
  if (!quote || !org) return NextResponse.json({ error: 'Nabídka nenalezena' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const to = String(body.to ?? '').trim() || quote.deal.client.email?.trim() || ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: 'Zadejte platnou e-mailovou adresu.' }, { status: 400 })
  }
  const zprava = typeof body.zprava === 'string' && body.zprava.trim()
    ? body.zprava.trim().slice(0, 2000)
    : null

  try {
    const [pdf, share] = await Promise.all([
      renderQuotePdf(quote.id, orgId, org.plan),
      ensureQuoteShare(quote.id, orgId),
    ])

    const filename = buildPdfFilename({
      clientJmeno: quote.deal.client.jmeno,
      clientPrijmeni: quote.deal.client.prijmeni,
      quoteKod: quote.kod,
      dealKod: quote.deal.kod,
      technologie: quote.deal.technologie,
    })

    const klientJmeno = `${quote.deal.client.jmeno} ${quote.deal.client.prijmeni ?? ''}`.trim()
    const html = emailCenovaNabidka({
      orgNazev: org.nazev,
      primaryColor: settings.primaryColor,
      klientJmeno,
      kod: quote.kod,
      zprava,
      url: share ? quoteShareUrl(session.user.orgSlug, share.token) : null,
      platnostDni: QUOTE_SHARE_DNI,
    })

    await sendOrgEmail(
      orgId,
      to,
      `Cenová nabídka${quote.kod ? ` ${quote.kod}` : ''} — ${org.nazev}`,
      html,
      [{ filename, content: pdf }]
    )

    await db.activity.create({
      data: {
        dealId: quote.deal.id,
        userId: session.user.id,
        typ: 'EMAIL',
        datum: new Date(),
        popis: `Nabídka${quote.kod ? ` ${quote.kod}` : ''} odeslána e-mailem na ${to}`,
      },
    })

    return NextResponse.json({ ok: true, to })
  } catch (err) {
    console.error('[quote-send-email] error:', err)
    return NextResponse.json({ error: 'E-mail se nepodařilo odeslat. Zkontrolujte SMTP nastavení.' }, { status: 502 })
  }
}
