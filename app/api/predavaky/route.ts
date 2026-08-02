import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { generatePredavakCislo } from '@/lib/zakazkyHelpers'
import { canTechnikAccessZakazka } from '@/lib/zakazkyHelpers'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const role = session.user.role
  const body = await req.json()
  const { zakazkaId, etapaId } = body

  if (!zakazkaId) return NextResponse.json({ error: 'Chybí zakazkaId' }, { status: 400 })

  // Check access — OBCHODNIK je v modulu zakázek manažer (schvaluje protokoly), smí je i zakládat
  if (role === 'TECHNIK' && !(await canTechnikAccessZakazka(session.user.id, zakazkaId, session.user.orgId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const zakazka = await db.zakazka.findFirst({
    where: { id: zakazkaId, orgId },
    include: { polozky: { orderBy: { poradi: 'asc' } } },
  })
  if (!zakazka) return NextResponse.json({ error: 'Zakázka nenalezena' }, { status: 404 })

  const cislo = await generatePredavakCislo(orgId)

  const predavak = await db.predavak.create({
    data: {
      orgId,
      zakazkaId,
      cislo,
      technikId: session.user.id,
      stav: 'ROZPRACOVAN',
      etapaId: etapaId ?? null,
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

  return NextResponse.json(predavak, { status: 201 })
}
