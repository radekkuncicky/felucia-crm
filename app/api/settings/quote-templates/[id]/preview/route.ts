import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { renderPreviewFromHtml, renderPreviewFromHtmlMock, renderQuoteHtml, renderTemplateMockPreview } from '@/lib/quoteRenderer'
import type { QuoteTemplate, QuoteTemplateConfig, QuoteTemplateHtml } from '@prisma/client'
import puppeteer from 'puppeteer'
import { hardenPdfPage, setContentAndWait } from '@/lib/pdf'
import { forbidden, getPerms } from '@/lib/permissions'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).nastaveniOrg) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const template = await db.quoteTemplate.findFirst({
    where: { id: params.id, orgId },
    include: { config: true, htmlTemplate: true },
  })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { quoteId, htmlContent, cssContent } = body

  // Najdi existující nabídku jako zdroj dat — fallback na mock data
  const sampleQuote = quoteId
    ? await db.quote.findFirst({ where: { id: quoteId, deal: { orgId } } })
    : await db.quote.findFirst({
        where: { deal: { orgId } },
        include: { deal: true },
        orderBy: { vytvoreno: 'desc' },
      })

  try {
    let pdfBuffer: Buffer

    if (htmlContent !== undefined) {
      pdfBuffer = sampleQuote
        ? await renderPreviewFromHtml(htmlContent, cssContent ?? null, sampleQuote.id, orgId)
        : await renderPreviewFromHtmlMock(htmlContent, cssContent ?? null)
    } else if (sampleQuote) {
      const org = await db.organization.findUnique({ where: { id: orgId }, select: { plan: true } })
      const html = await renderQuoteHtml(sampleQuote.id, orgId, org?.plan ?? 'STARTER')

      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
      try {
        const page = await browser.newPage()
        await hardenPdfPage(page)
        await setContentAndWait(page, html)
        const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } })
        pdfBuffer = Buffer.from(pdf)
      } finally {
        await browser.close()
      }
    } else {
      pdfBuffer = await renderTemplateMockPreview(template as QuoteTemplate & { config: QuoteTemplateConfig | null; htmlTemplate: QuoteTemplateHtml | null })
    }

    return new Response(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="nahled-sablony.pdf"',
      },
    })
  } catch (err) {
    console.error('Template preview error:', err)
    return NextResponse.json({ error: 'Chyba při generování náhledu.' }, { status: 500 })
  }
}
