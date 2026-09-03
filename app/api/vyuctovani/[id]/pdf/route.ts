import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { generateVyuctovaniHtml } from '@/lib/vyuctovaniPdf'
import { generatePdf } from '@/lib/pdf'
import { getPerms, forbidden } from '@/lib/permissions'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (!perms.financeProdejni) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const v = await db.vyuctovani.findFirst({
    where: { id: params.id, orgId },
    include: {
      schvalil: { select: { jmeno: true } },
      zakazka: {
        include: {
          klient: { select: { jmeno: true, prijmeni: true, telefon: true, email: true, ulice: true, mesto: true, psc: true, ico: true } },
          organization: { select: { nazev: true, sidlo: true, email: true, logo: true, ico: true, dic: true, telefon: true } },
        },
      },
      polozky: { orderBy: { poradi: 'asc' } },
    },
  })

  if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const html = generateVyuctovaniHtml({
    id: v.id,
    cislo: v.cislo,
    stav: v.stav,
    poznamka: v.poznamka,
    vytvoreno: v.vytvoreno.toISOString(),
    schvaleno: v.schvaleno?.toISOString() ?? null,
    schvalil: v.schvalil,
    zakazka: {
      cislo: v.zakazka.cislo,
      nazev: v.zakazka.nazev,
      klient: v.zakazka.klient,
      organization: v.zakazka.organization,
    },
    polozky: v.polozky.map(p => ({
      nazev: p.nazev,
      mnozstvi: Number(p.mnozstvi),
      jednotka: p.jednotka,
      nakupniCena: perms.financeNakupky && p.nakupniCena !== null ? Number(p.nakupniCena) : null,
      prodejniCena: Number(p.prodejniCena),
      dphSazba: Number(p.dphSazba),
    })),
  })

  const pdf = await generatePdf(html)

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${v.cislo}.pdf"`,
    },
  })
}
