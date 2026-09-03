import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { canAccessPredavak } from '@/lib/zakazkyHelpers'
import { generatePredavakHtml } from '@/lib/predavakPdf'
import { generatePdf } from '@/lib/pdf'
import { getPerms, forbidden } from '@/lib/permissions'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const perms = getPerms(session.user)

  const predavak = await db.predavak.findFirst({
    where: { id: params.id, orgId },
    include: {
      technik: { select: { id: true, jmeno: true, email: true, telefon: true } },
      zakazka: {
        include: {
          klient: { select: { jmeno: true, prijmeni: true, telefon: true, email: true, ulice: true, mesto: true, psc: true } },
          organization: { select: { nazev: true, sidlo: true, email: true, logo: true, ico: true, telefon: true } },
        },
      },
      polozky: { orderBy: { id: 'asc' } },
      fotky: { orderBy: { vytvoreno: 'asc' } },
    },
  })

  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!(await canAccessPredavak(session.user, perms, predavak))) return forbidden()
  // Kdo protokoly neschvaluje (technik), stáhne jen schválené
  if (!perms.zakazkySchvalovani) {
    if (predavak.stav !== 'SCHVALEN') {
      return NextResponse.json({ error: 'PDF dostupné jen pro schválené protokoly' }, { status: 403 })
    }
  }

  const html = generatePredavakHtml({
    id: predavak.id,
    cislo: predavak.cislo,
    stav: predavak.stav,
    poznamka: predavak.poznamka,
    klientPritomen: predavak.klientPritomen,
    podpisSvg: predavak.podpisSvg,
    podpisano: predavak.podpisano?.toISOString() ?? null,
    schvaleno: predavak.schvaleno?.toISOString() ?? null,
    zakazka: {
      cislo: predavak.zakazka.cislo,
      nazev: predavak.zakazka.nazev,
      technologie: predavak.zakazka.technologie,
      klient: predavak.zakazka.klient,
      organization: predavak.zakazka.organization,
    },
    technik: predavak.technik,
    polozky: predavak.polozky.map(p => ({
      nazev: p.nazev,
      planovanoMnozstvi: Number(p.planovanoMnozstvi),
      mnozstviPouzito: Number(p.mnozstviPouzito),
      jednotka: p.jednotka,
      zahrnuto: p.zahrnuto,
      poznamka: p.poznamka,
    })),
    fotky: predavak.fotky.map(f => ({ url: f.url, popis: f.popis })),
  })

  const pdf = await generatePdf(html)

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${predavak.cislo}.pdf"`,
    },
  })
}
