import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { KONTROLNI_KONTAKT_CIL, KONTROLNI_KONTAKT_DNI, zaPracovnichDni, kontrolniKontaktPopis, type KontrolniKontaktTyp } from '@/lib/kontrolniKontakt'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { renderQuotePdf } from '@/lib/quoteRenderer'
import { buildPdfFilename } from '@/lib/quoteKod'
import { isOrgEmailConfigured, sendOrgEmail, emailCenovaNabidka } from '@/lib/email'
import { isSmsConfigured, normalizeTelefon, sendSms } from '@/lib/sms'
import { getOrgSettings } from '@/lib/orgSettings'
import { ensureQuoteShare, quoteShareUrl, QUOTE_SHARE_DNI } from '@/lib/quoteShare'
import { checkRateLimit } from '@/lib/rateLimit'

// POST /api/mobile/obchod/nabidka/[id]/odeslat — odeslání nabídky klientovi
// přímo ze schůzky. { kanal: 'EMAIL' | 'SMS', to?, zprava? }
// EMAIL = PDF v příloze + veřejný odkaz; SMS = veřejný odkaz.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)

  const { limited } = checkRateLimit(`quote-odeslat:${userId}`, 10, 3600_000)
  if (limited) return NextResponse.json({ error: 'Příliš mnoho odeslání, zkuste to později.' }, { status: 429 })

  const [quote, org, settings] = await Promise.all([
    db.quote.findFirst({
      where: { id: params.id },
      select: {
        id: true,
        kod: true,
        deal: {
          select: {
            id: true,
            orgId: true,
            kod: true,
            technologie: true,
            client: { select: { jmeno: true, prijmeni: true, email: true, telefon: true } },
          },
        },
      },
    }),
    db.organization.findUnique({ where: { id: orgId }, select: { nazev: true, slug: true, plan: true } }),
    getOrgSettings(orgId),
  ])
  if (!quote || !org) return NextResponse.json({ error: 'Nabídka nenalezena' }, { status: 404 })

  let body: { kanal?: string; to?: string; zprava?: string; kontrola?: KontrolaInput | null }
  try { body = await req.json() } catch { body = {} }
  const kanal = body.kanal === 'SMS' ? 'SMS' : body.kanal === 'EMAIL' ? 'EMAIL' : null
  if (!kanal) return NextResponse.json({ error: 'kanal musí být EMAIL nebo SMS' }, { status: 400 })
  const kontrola = parseKontrola(body.kontrola)
  if (kontrola === 'invalid') return NextResponse.json({ error: 'kontrola: neplatný typ nebo datum' }, { status: 400 })

  const klientJmeno = `${quote.deal.client.jmeno} ${quote.deal.client.prijmeni ?? ''}`.trim()

  if (kanal === 'EMAIL') {
    if (!(await isOrgEmailConfigured(orgId))) {
      return NextResponse.json({
        error: 'Odesílání e-mailů není nastaveno (Nastavení → E-mail).',
        code: 'EMAIL_NOT_CONFIGURED',
      }, { status: 400 })
    }
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
      const html = emailCenovaNabidka({
        orgNazev: org.nazev,
        primaryColor: settings.primaryColor,
        klientJmeno,
        kod: quote.kod,
        zprava,
        url: share ? quoteShareUrl(org.slug, share.token) : null,
        platnostDni: QUOTE_SHARE_DNI,
      })
      await sendOrgEmail(
        orgId,
        to,
        `Cenová nabídka${quote.kod ? ` ${quote.kod}` : ''} — ${org.nazev}`,
        html,
        [{ filename, content: pdf }],
      )
      await zaznamenejOdeslani(db, quote, userId, 'EMAIL', `na ${to}`)
      const kontrolaId = await naplanujKontrolu(db, quote, userId, kontrola)
      return NextResponse.json({ ok: true, kanal, to, kontrolaId })
    } catch (err) {
      console.error('[mobile-nabidka-odeslat] email error:', err)
      return NextResponse.json({ error: 'E-mail se nepodařilo odeslat.' }, { status: 502 })
    }
  }

  // SMS
  if (!isSmsConfigured()) {
    return NextResponse.json({ error: 'SMS brána není nastavena.', code: 'SMS_NOT_CONFIGURED' }, { status: 400 })
  }
  const rawTelefon = String(body.to ?? '').trim() || quote.deal.client.telefon?.trim() || ''
  const telefon = rawTelefon ? normalizeTelefon(rawTelefon) : null
  if (!telefon) return NextResponse.json({ error: 'Zadejte platné české telefonní číslo.' }, { status: 400 })

  try {
    const share = await ensureQuoteShare(quote.id, orgId)
    if (!share) return NextResponse.json({ error: 'Nepodařilo se vytvořit odkaz na nabídku.' }, { status: 500 })
    const url = quoteShareUrl(org.slug, share.token)
    await sendSms(telefon, `${org.nazev}: cenová nabídka${quote.kod ? ` ${quote.kod}` : ''} — ${url}`)
    await zaznamenejOdeslani(db, quote, userId, 'SMS', `na +${telefon}`)
    const kontrolaId = await naplanujKontrolu(db, quote, userId, kontrola)
    return NextResponse.json({ ok: true, kanal, to: `+${telefon}`, kontrolaId })
  } catch (err) {
    console.error('[mobile-nabidka-odeslat] sms error:', err)
    return NextResponse.json({ error: 'SMS se nepodařilo odeslat.' }, { status: 502 })
  }
}

/**
 * Kontrolní kontakt po odeslání (volitelné): { typ: 'HOVOR'|'EMAIL', dni?: number, datum?: ISO }.
 * Bez `kontrola` se nic neplánuje — dotaz s předvolbou zobrazuje appka.
 */
type KontrolaInput = { typ?: string; dni?: number; datum?: string }
type Kontrola = { typ: KontrolniKontaktTyp; datum: Date }

function parseKontrola(k: KontrolaInput | null | undefined): Kontrola | null | 'invalid' {
  if (!k || typeof k !== 'object') return null
  const typ = k.typ === 'EMAIL' ? 'EMAIL' : k.typ === 'HOVOR' || k.typ === undefined ? 'HOVOR' : null
  if (!typ) return 'invalid'
  let datum: Date
  if (typeof k.datum === 'string') {
    datum = new Date(k.datum)
    if (Number.isNaN(datum.getTime())) return 'invalid'
  } else {
    const dni = typeof k.dni === 'number' && k.dni >= 0 && k.dni <= 60 ? k.dni : KONTROLNI_KONTAKT_DNI
    datum = zaPracovnichDni(dni)
  }
  return { typ, datum }
}

async function naplanujKontrolu(
  db: ReturnType<typeof orgPrisma>,
  quote: { kod: string | null; deal: { id: string; orgId: string } },
  userId: string,
  kontrola: Kontrola | null,
): Promise<string | null> {
  if (!kontrola) return null
  const p = (n: number) => String(n).padStart(2, '0')
  const a = await db.activity.create({
    data: {
      orgId: quote.deal.orgId,
      dealId: quote.deal.id,
      userId,
      resitelId: userId,
      typ: kontrola.typ,
      datum: kontrola.datum,
      cas: `${p(kontrola.datum.getHours())}:${p(kontrola.datum.getMinutes())}`,
      popis: kontrolniKontaktPopis(quote.kod, kontrola.typ),
      cil: KONTROLNI_KONTAKT_CIL,
      reminderAt: kontrola.datum,
    },
    select: { id: true },
  })
  return a.id
}

async function zaznamenejOdeslani(
  db: ReturnType<typeof orgPrisma>,
  quote: { id: string; kod: string | null; deal: { id: string; kod: string | null; orgId: string } },
  userId: string,
  kanal: 'EMAIL' | 'SMS',
  komu: string,
) {
  await db.quote.update({
    where: { id: quote.id },
    data: { odeslanoAt: new Date(), odeslanoKanal: kanal },
  })
  await db.activity.create({
    data: {
      orgId: quote.deal.orgId,
      dealId: quote.deal.id,
      userId,
      typ: kanal === 'EMAIL' ? 'EMAIL' : 'POZNAMKA',
      datum: new Date(),
      popis: `Nabídka${quote.kod ? ` ${quote.kod}` : ''} odeslána ${kanal === 'EMAIL' ? 'e-mailem' : 'SMS'} ${komu}`,
      splneno: true,
      stav: 'DOKONCENA',
    },
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
