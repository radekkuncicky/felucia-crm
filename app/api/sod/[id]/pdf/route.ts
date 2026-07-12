import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { generateSodHtml } from '@/lib/sodDocument'
import { generatePdf } from '@/lib/pdf'
import { buildDokumentChrome } from '@/lib/dokumentyChrome'
import { renderSodContractHtml } from '@/lib/sodContractHtml'
import { renderQuotePdf } from '@/lib/quoteRenderer'
import { mergePdfs } from '@/lib/mergePdfs'
import fs from 'fs'
import path from 'path'
import { formatDate } from '@/lib/format'

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
        select: {
          nazev: true, sidlo: true, ico: true, dic: true, email: true, telefon: true,
          prilohaVopPath: true, prilohaVzspPath: true, prilohaCenikPath: true,
        },
      },
    },
  })

  if (!sod) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let html: string

  if (sod.textSmlouvy) {
    html = renderSodContractHtml(sod.textSmlouvy)
  } else {
    const datum = formatDate(sod.vytvoreno)
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
  const sodPdf = await generatePdf(html, chrome)

  const pdfParts: Buffer[] = [sodPdf]

  // Cenová nabídka
  if (sod.prilohaNabidka && sod.dealId) {
    try {
      const activeQuote = await prisma.quote.findFirst({
        where: { dealId: sod.dealId, orgId, aktivni: true },
        select: { id: true },
      })
      if (activeQuote) {
        const qPdf = await renderQuotePdf(activeQuote.id, orgId, session.user.plan)
        pdfParts.push(qPdf)
      }
    } catch { /* skip if quote PDF fails */ }
  }

  // Statické přílohy (VOP, VZSP, Ceník)
  const attachDefs: { flag: boolean; pathField: string | null | undefined }[] = [
    { flag: sod.prilohaVop,   pathField: sod.organization.prilohaVopPath },
    { flag: sod.prilohaVzsp,  pathField: sod.organization.prilohaVzspPath },
    { flag: sod.prilohaCenik, pathField: sod.organization.prilohaCenikPath },
  ]

  for (const { flag, pathField } of attachDefs) {
    if (!flag || !pathField) continue
    try {
      const absPath = path.join(process.cwd(), 'public', pathField)
      const buf = fs.readFileSync(absPath)
      pdfParts.push(buf)
    } catch { /* file missing — skip */ }
  }

  const finalPdf = pdfParts.length > 1 ? await mergePdfs(pdfParts) : pdfParts[0]

  return new NextResponse(finalPdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${sod.cislo}.pdf"`,
    },
  })
}
