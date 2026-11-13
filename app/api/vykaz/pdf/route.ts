import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { orgPrisma } from '@/lib/orgPrisma'
import { generatePdf } from '@/lib/pdf'
import { generateVykazHtml } from '@/lib/vykazPdf'
import { VYKAZ_INCLUDE, castkaZaznamu, num, souctyVykazu, verifyVykazPdfSignature, zakazkaZaznamu } from '@/lib/vykazPrace'

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
  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: { id: true, orgId: true, jmeno: true, email: true, telefon: true, aktivni: true, organization: { select: { nazev: true } } },
  })
  if (!user || !user.aktivni) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const db = orgPrisma(user.orgId)
  const fakturace = await db.vykazFakturace.findFirst({
    where: { id: fakturaceId!, orgId: user.orgId, userId: user.id },
    include: { zaznamy: { include: VYKAZ_INCLUDE, orderBy: [{ datum: 'asc' }, { vytvoreno: 'asc' }] } },
  })
  if (!fakturace) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const s = souctyVykazu(fakturace.zaznamy)
  const html = generateVykazHtml({
    orgNazev: user.organization.nazev,
    technik: { jmeno: user.jmeno, email: user.email, telefon: user.telefon },
    cislo: fakturace.cislo,
    obdobiOd: fakturace.obdobiOd,
    obdobiDo: fakturace.obdobiDo,
    vytvoreno: fakturace.vytvoreno,
    radky: fakturace.zaznamy.map(z => {
      const zak = zakazkaZaznamu(z)
      return {
        typ: z.typ, datum: z.datum, cislo: zak.cislo, nazev: zak.nazev,
        hodiny: num(z.hodiny), km: z.km, popis: z.popis, poznamka: z.poznamka, castka: castkaZaznamu(z),
      }
    }),
    soucty: s,
  })
  const pdf = await generatePdf(html)
  const jmeno = user.jmeno.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-')
  return new Response(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="vykaz-prace-${fakturace.cislo}-${jmeno}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
