import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, type MobileSession } from '@/lib/mobile-helpers'

async function canAccess(session: MobileSession, predavakId: string): Promise<boolean> {
  const p = await prisma.predavak.findFirst({ where: { id: predavakId, orgId: session.user.orgId } })
  if (!p) return false
  if (session.user.role === 'ADMIN') return true
  if (p.technikId === session.user.id) return true
  // Allow any technik assigned to the zakázka
  const rel = await prisma.technikZakazka.findFirst({
    where: { technikId: session.user.id, zakazkaId: p.zakazkaId },
  })
  return !!rel
}

export async function GET(req: Request, { params }: { params: { predavakId: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  if (!(await canAccess(session!, params.predavakId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const predavak = await prisma.predavak.findFirst({
    where: { id: params.predavakId, orgId: session!.user.orgId },
    include: {
      polozky: { orderBy: { id: 'asc' } },
      zakazka: {
        include: {
          klient: { select: { jmeno: true, prijmeni: true } },
        },
      },
    },
  })
  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    id: predavak.id,
    cislo: predavak.cislo,
    stav: predavak.stav,
    klientPritomen: predavak.klientPritomen,
    klientPodepsal: !!predavak.podpisSvg,
    poznamka: predavak.poznamka,
    podpisano: predavak.podpisano,
    odmitnutoDuvod: predavak.odmitnutoDuvod ?? null,
    upravenoPodpisano: predavak.upravenoPodpisano,
    zakazka: {
      id: predavak.zakazkaId,
      cislo: predavak.zakazka.cislo,
      nazev: predavak.zakazka.nazev,
      klient: `${predavak.zakazka.klient.jmeno} ${predavak.zakazka.klient.prijmeni}`,
    },
    polozky: predavak.polozky.map(p => ({
      id: p.id,
      nazev: p.nazev,
      planovanoMnozstvi: Number(p.planovanoMnozstvi),
      mnozstviPouzito: Number(p.mnozstviPouzito),
      jednotka: p.jednotka,
      zahrnuto: p.zahrnuto,
      poznamka: p.poznamka,
    })),
  })
}

export async function PATCH(req: Request, { params }: { params: { predavakId: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  if (!(await canAccess(session!, params.predavakId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const predavak = await prisma.predavak.findFirst({
    where: { id: params.predavakId, orgId: session!.user.orgId },
  })
  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const editableStavs = ['ROZPRACOVAN', 'ODMITNUTO', 'PODPISAN']
  if (!editableStavs.includes(predavak.stav)) {
    return NextResponse.json({ error: 'Nelze editovat protokol v tomto stavu' }, { status: 422 })
  }

  const { poznamka, klientPritomen, polozky, podpisSvg } = await req.json()
  const wasAlreadySigned = predavak.stav === 'PODPISAN'

  await prisma.$transaction(async tx => {
    await tx.predavak.update({
      where: { id: params.predavakId },
      data: {
        poznamka: poznamka ?? undefined,
        klientPritomen: klientPritomen ?? undefined,
        ...(podpisSvg ? { podpisSvg } : {}),
        ...(wasAlreadySigned ? { upravenoPodpisano: true } : {}),
      },
    })

    if (Array.isArray(polozky)) {
      for (const p of polozky) {
        await tx.predavakPolozka.update({
          where: { id: p.id, predavakId: params.predavakId },
          data: {
            mnozstviPouzito: p.mnozstviPouzito ?? 0,
            zahrnuto: p.zahrnuto ?? true,
            poznamka: p.poznamka ?? null,
          },
        })
      }
    }
  })

  return NextResponse.json({ ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
