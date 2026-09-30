import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'
import { priraditTechnikaKZakazce } from '@/lib/techniciZakazky'

// POST { technikId } — přiřadí technika k etapě (a tím i k zakázce)
export async function POST(req: Request, { params }: { params: { id: string; etapaId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).zakazkyEdit) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const body = await req.json().catch(() => null)
  const technikId = typeof body?.technikId === 'string' ? body.technikId : null
  if (!technikId) return NextResponse.json({ error: 'Chybí technik' }, { status: 400 })

  const etapa = await db.zakazkaEtapa.findFirst({
    where: { id: params.etapaId, zakazkaId: params.id, orgId },
    include: { zakazka: { select: { id: true, cislo: true, nazev: true, stav: true } } },
  })
  if (!etapa) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const technik = await db.user.findFirst({ where: { id: technikId, orgId }, select: { id: true, jmeno: true } })
  if (!technik) return NextResponse.json({ error: 'Technik nenalezen' }, { status: 400 })

  const existuje = await db.etapaTechnik.findFirst({ where: { etapaId: etapa.id, technikId } })
  if (!existuje) {
    await db.etapaTechnik.create({ data: { orgId, etapaId: etapa.id, technikId } })
  }
  const { novy: novyNaZakazce, zakazkaNovyStav } = await priraditTechnikaKZakazce(db, {
    orgId, userId: session.user.id, zakazka: etapa.zakazka, technikId,
  })

  return NextResponse.json({ technik, novyNaZakazce, zakazkaNovyStav }, { status: 201 })
}
