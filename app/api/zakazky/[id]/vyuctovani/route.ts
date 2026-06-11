import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { generateVyuctovaniCislo } from '@/lib/zakazkyHelpers'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId

  let predavakId: string | undefined
  let etapaId: string | undefined
  try {
    const body = await req.json()
    predavakId = body?.predavakId
    etapaId = body?.etapaId
  } catch {
    // no body or invalid JSON
  }

  const cislo = await generateVyuctovaniCislo(orgId)

  if (predavakId) {
    // Create vyúčtování from approved PP items
    const predavak = await prisma.predavak.findFirst({
      where: { id: predavakId, orgId, zakazkaId: params.id },
      include: {
        polozky: {
          where: { zahrnuto: true },
          include: { zakazkaPolozka: true },
        },
      },
    })
    if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const sortedPolozky = [...predavak.polozky].sort(
      (a, b) => (a.zakazkaPolozka?.poradi ?? 999) - (b.zakazkaPolozka?.poradi ?? 999)
    )

    const vyuctovani = await prisma.vyuctovani.create({
      data: {
        orgId,
        zakazkaId: params.id,
        cislo,
        stav: 'NAVRH',
        etapaId: etapaId ?? predavak.etapaId ?? null,
        polozky: {
          create: sortedPolozky.map((p, idx) => ({
            nazev: p.nazev,
            mnozstvi: p.mnozstviPouzito,
            jednotka: p.jednotka,
            prodejniCena: p.zakazkaPolozka?.prodejniCena ?? 0,
            nakupniCena: p.zakazkaPolozka?.nakupniCena ?? undefined,
            dphSazba: p.zakazkaPolozka?.dphSazba ?? 21,
            poradi: idx,
          })),
        },
      },
    })
    return NextResponse.json(vyuctovani, { status: 201 })
  }

  // Default: create from zakazka polozky
  const zakazka = await prisma.zakazka.findFirst({
    where: { id: params.id, orgId },
    include: { polozky: { orderBy: { poradi: 'asc' } } },
  })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const vyuctovani = await prisma.vyuctovani.create({
    data: {
      orgId,
      zakazkaId: params.id,
      cislo,
      stav: 'NAVRH',
      etapaId: etapaId ?? null,
      polozky: {
        create: zakazka.polozky.map((p, idx) => ({
          nazev: p.nazev,
          mnozstvi: p.mnozstvi,
          jednotka: p.jednotka,
          prodejniCena: p.prodejniCena ?? 0,
          nakupniCena: p.nakupniCena ?? undefined,
          dphSazba: p.dphSazba,
          poradi: idx,
        })),
      },
    },
  })

  return NextResponse.json(vyuctovani, { status: 201 })
}
