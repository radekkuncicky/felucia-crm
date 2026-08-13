import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, type MobileSession } from '@/lib/mobile-helpers'

async function canAccess(session: MobileSession, predavakId: string): Promise<boolean> {
  const p = await orgPrisma(session!.user.orgId).predavak.findFirst({ where: { id: predavakId, orgId: session.user.orgId } })
  if (!p) return false
  if (session.user.role === 'ADMIN') return true
  if (p.technikId === session.user.id) return true
  const rel = await orgPrisma(session!.user.orgId).technikZakazka.findFirst({
    where: { technikId: session.user.id, zakazkaId: p.zakazkaId },
  })
  return !!rel
}

// POST /api/mobile/predavak/[predavakId]/polozky — přidání vlastní položky
// { nazev, mnozstvi?, jednotka? }
export async function POST(req: Request, { params }: { params: { predavakId: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  if (!(await canAccess(session!, params.predavakId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = orgPrisma(session!.user.orgId)
  const predavak = await db.predavak.findFirst({ where: { id: params.predavakId, orgId: session!.user.orgId } })
  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (predavak.stav !== 'ROZPRACOVAN' && predavak.stav !== 'ODMITNUTO') {
    return NextResponse.json({ error: 'Nelze přidat položku v tomto stavu' }, { status: 422 })
  }

  const { nazev, mnozstvi, jednotka } = await req.json().catch(() => ({})) as {
    nazev?: string; mnozstvi?: number; jednotka?: string
  }
  if (!nazev?.trim()) return NextResponse.json({ error: 'Chybí název' }, { status: 400 })

  const polozka = await db.predavakPolozka.create({
    data: {
      predavakId: params.predavakId,
      nazev: nazev.trim(),
      planovanoMnozstvi: mnozstvi ?? 1,
      mnozstviPouzito: mnozstvi ?? 1,
      jednotka: jednotka?.trim() || 'ks',
      zahrnuto: true,
    },
  })

  return NextResponse.json({
    id: polozka.id,
    nazev: polozka.nazev,
    planovanoMnozstvi: Number(polozka.planovanoMnozstvi),
    mnozstviPouzito: Number(polozka.mnozstviPouzito),
    jednotka: polozka.jednotka,
    zahrnuto: polozka.zahrnuto,
    poznamka: polozka.poznamka,
  }, { status: 201 })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
