import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { generateSodDocx } from '@/lib/sodDocx'

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

  const datum = sod.vytvoreno.toLocaleDateString('cs-CZ')

  const docx = await generateSodDocx({
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

  return new NextResponse(docx as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${sod.cislo}.docx"`,
    },
  })
}
