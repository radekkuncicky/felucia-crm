import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin } from '@/lib/mobile-helpers'
import { dnesPraha } from '@/lib/dnesniVyjezdy'

/**
 * GET /api/mobile/mesic — „Můj měsíc“ na kartě Já (audit APP_TECHNIK J): co technik tento měsíc
 * odvedl. Žádné body ani žebříčky, jen vlastní práce: předané zakázky, dokončené servisy, fotky, poznámky.
 */
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)
  const mesic = dnesPraha().slice(0, 7)
  const od = new Date(`${mesic}-01T00:00:00.000Z`)

  const [predano, schvaleno, servisy, fotek, poznamek] = await Promise.all([
    db.predavak.count({ where: { orgId, technikId: userId, podpisano: { gte: od } } }),
    db.predavak.count({ where: { orgId, technikId: userId, schvaleno: { gte: od } } }),
    db.servisniZakazka.count({ where: { orgId, technikId: userId, protokolDokoncen: { gte: od } } }),
    db.zakazkaFoto.count({ where: { nahralId: userId, vytvoreno: { gte: od }, zakazka: { orgId } } }),
    db.zakazkaKomentar.count({ where: { userId, vytvoreno: { gte: od }, zakazka: { orgId } } }),
  ])

  return NextResponse.json({ mesic, predano, schvaleno, servisy, fotek, poznamek })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
