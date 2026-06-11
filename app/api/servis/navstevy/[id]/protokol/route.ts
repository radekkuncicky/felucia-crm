import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { generateServisniProtokolHtml } from '@/lib/servisniProtokolHtml'
import puppeteer from 'puppeteer'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const navsteva = await prisma.servisniNavsteva.findFirst({
    where: { id: params.id, orgId },
    include: {
      technik: { select: { jmeno: true } },
      zarizeni: {
        select: {
          nazev: true,
          typ: true,
          vyrobniCislo: true,
          datumInstalace: true,
          zarukaDo: true,
        },
      },
      klient: {
        select: {
          jmeno: true,
          prijmeni: true,
          telefon: true,
          email: true,
          ulice: true,
          mesto: true,
          psc: true,
        },
      },
    },
  })

  if (!navsteva) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { nazev: true, sidlo: true, ico: true, email: true, telefon: true, logo: true },
  })

  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

  try {
    const html = generateServisniProtokolHtml(navsteva, navsteva.zarizeni, navsteva.klient, org)

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    await browser.close()

    const cislo = navsteva.cisloNavstevy ?? navsteva.id.slice(0, 8).toUpperCase()
    const filename = `servisni-protokol-${cislo}.pdf`

    return new Response(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('Protokol PDF error:', err)
    return NextResponse.json({ error: 'Chyba při generování PDF.' }, { status: 500 })
  }
}
