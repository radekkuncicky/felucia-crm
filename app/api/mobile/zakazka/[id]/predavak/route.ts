import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
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
  const db = orgPrisma(orgId)

  // Return existing open predávák if any
  const existing = await db.predavak.findFirst({
    where: { zakazkaId: params.id, orgId, stav: { in: ['ROZPRACOVAN', 'ODMITNUTO'] } },
    orderBy: { vytvoreno: 'desc' },
  })
  if (existing) {
    return NextResponse.json({ id: existing.id, cislo: existing.cislo, stav: existing.stav })
  }

  const zakazka = await db.zakazka.findFirst({
    where: { id: params.id, orgId },
    include: { polozky: { orderBy: { poradi: 'asc' } } },
  })
  if (!zakazka) return NextResponse.json({ error: 'Zakázka nenalezena' }, { status: 404 })

  const cislo = await generatePredavakCislo(orgId)

  // Protokol z appky se automaticky zařadí do aktuálně otevřené etapy — poslední
  // etapa, která ještě není předaná (stejná logika jako web v PredavakyTab)
  const otevrenaEtapa = await db.zakazkaEtapa.findFirst({
    where: { zakazkaId: params.id, stav: { not: 'PREDANA' } },
    orderBy: { cislo: 'desc' },
    select: { id: true },
  })

  const predavak = await db.predavak.create({
    data: {
      orgId,
      zakazkaId: params.id,
      cislo,
      etapaId: otevrenaEtapa?.id ?? null,
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
