import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { generateSodHtml } from '@/lib/sodDocument'
import { generatePdf } from '@/lib/pdf'
import { buildDokumentChrome } from '@/lib/dokumentyChrome'
import { sanitizeFullDocumentHtml } from '@/lib/sanitizeHtml'

const PDF_STYLES = `
  body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.7; color: #000; }
  h1 { font-size: 14pt; font-weight: bold; text-align: center; margin: 1.2em 0 0.8em; }
  h2 { font-size: 12pt; font-weight: bold; margin: 1em 0 0.5em; }
  h3 { font-size: 11pt; font-weight: bold; margin: 0.8em 0 0.4em; }
  p { margin: 0 0 0.7em; }
  ul, ol { padding-left: 1.5em; margin: 0.4em 0; }
  li { margin: 0.2em 0; }
  strong { font-weight: bold; }
  em { font-style: italic; }
  u { text-decoration: underline; }
`

function wrapHtml(bodyHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${PDF_STYLES}</style></head><body>${bodyHtml}</body></html>`
}

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const paragraphs = escaped.split(/\n\n+/).map(p =>
    `<p>${p.replace(/\n/g, '<br>')}</p>`
  ).join('\n')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${PDF_STYLES}</style></head><body>${paragraphs}</body></html>`
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const sod = await db.sod.findFirst({
    where: { id: params.id, orgId },
    include: {
      organization: {
        select: { nazev: true, sidlo: true, ico: true, dic: true, email: true, telefon: true },
      },
    },
  })

  if (!sod) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let html: string

  if (sod.textSmlouvy) {
    html = sod.textSmlouvy.trimStart().startsWith('<')
      ? wrapHtml(sanitizeFullDocumentHtml(sod.textSmlouvy)) // i legacy data uložená před sanitizací
      : textToHtml(sod.textSmlouvy)
  } else {
    const datum = sod.vytvoreno.toLocaleDateString('cs-CZ')
    html = generateSodHtml({
      cislo: sod.cislo,
      typ: sod.typ,
      datum,
      klientJmeno: sod.klientJmeno,
      klientAdresa: sod.klientAdresa,
      klientEmail: sod.klientEmail,
      klientTelefon: sod.klientTelefon,
      klientIco: sod.klientIco,
      klientDic: sod.klientDic,
      kontaktniOsoba: sod.kontaktniOsoba,
      kontaktniTelefon: sod.kontaktniTelefon,
      predmetDila: sod.predmetDila,
      adresaDila: sod.adresaDila,
      terminPrevzeti: sod.terminPrevzeti,
      pocetDniRealizace: sod.pocetDniRealizace,
      zmenaTerm: sod.zmenaTerm,
      cenaBezDph: sod.cenaBezDph != null ? Number(sod.cenaBezDph) : null,
      cenaSDph: sod.cenaSDph != null ? Number(sod.cenaSDph) : null,
      dphSazba: Number(sod.dphSazba),
      zalohaKc: sod.zalohaKc != null ? Number(sod.zalohaKc) : null,
      zalohaSplatnost: sod.zalohaSplatnost,
      zalohaKategorie: sod.zalohaKategorie,
      org: sod.organization,
    })
  }

  const chrome = await buildDokumentChrome(orgId, session.user.plan)
  const pdf = await generatePdf(html, chrome)

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${sod.cislo}.pdf"`,
    },
  })
}
