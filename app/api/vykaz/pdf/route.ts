import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generatePdf } from '@/lib/pdf'
import { nactiVykazHtml } from '@/lib/vykazPdf'
import { verifyVykazPdfSignature } from '@/lib/vykazPrace'

// GET /api/vykaz/pdf?u=&f=&exp=&sig= — PDF uzavřeného výkazu práce.
// Bez session: autorizace podepsaným odkazem z /api/mobile/vykaz/pdf-odkaz (appka ho otevře v prohlížeči).
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const userId = sp.get('u')
  const fakturaceId = sp.get('f')
  if (!verifyVykazPdfSignature(userId, fakturaceId, sp.get('exp'), sp.get('sig'))) {
    return NextResponse.json({ error: 'Odkaz vypršel — otevři PDF znovu z aplikace' }, { status: 403 })
  }

  // org se teprve zjišťuje z uživatele (podpis ho váže) → bare prisma jen na tento lookup
  const user = await prisma.user.findUnique({ where: { id: userId! }, select: { id: true, orgId: true, aktivni: true } })
  if (!user || !user.aktivni) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const vykaz = await nactiVykazHtml(user.orgId, fakturaceId!, user.id)
  if (!vykaz) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const pdf = await generatePdf(vykaz.html)
  return new Response(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${vykaz.nazevSouboru}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
