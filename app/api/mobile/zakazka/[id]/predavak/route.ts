import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, canAccessZakazka } from '@/lib/mobile-helpers'
import { generatePredavakCislo } from '@/lib/zakazkyHelpers'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  if (!(await canAccessZakazka(session!, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orgId = session!.user.orgId

  // Return existing open predávák if any
  const existing = await prisma.predavak.findFirst({
    where: { zakazkaId: params.id, orgId, stav: { in: ['ROZPRACOVAN', 'ODMITNUTO'] } },
    orderBy: { vytvoreno: 'desc' },
  })
  if (existing) {
    return NextResponse.json({ id: existing.id, cislo: existing.cislo, stav: existing.stav })
  }

  const zakazka = await prisma.zakazka.findFirst({
    where: { id: params.id, orgId },
    include: { polozky: { orderBy: { poradi: 'asc' } } },
  })
  if (!zakazka) return NextResponse.json({ error: 'Zakázka nenalezena' }, { status: 404 })

  const cislo = await generatePredavakCislo(orgId)

  const predavak = await prisma.predavak.create({
    data: {
      orgId,
      zakazkaId: params.id,
      cislo,
      technikId: session!.user.id,
      stav: 'ROZPRACOVAN',
      polozky: {
        create: zakazka.polozky.map(p => ({
          zakazkaPolozkaId: p.id,
          nazev: p.nazev,
          planovanoMnozstvi: p.mnozstvi,
          mnozstviPouzito: p.mnozstvi,
          jednotka: p.jednotka,
          zahrnuto: true,
        })),
      },
    },
  })

  return NextResponse.json({ id: predavak.id, cislo: predavak.cislo, stav: predavak.stav }, { status: 201 })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
