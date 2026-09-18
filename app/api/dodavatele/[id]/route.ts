import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'
import { DODAVATEL_SELECT, dodavatelDataFromBody, validateDodavatel } from '@/lib/dodavatele'

/** Detail dodavatele vč. produktů, které dodává (nákupní ceny jen za financeNakupky). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (perms.sklad === 'ZADNY') return forbidden()

  const orgId = session.user.orgId
  const d = await orgPrisma(orgId).dodavatel.findFirst({
    where: { id: params.id, orgId },
    select: {
      ...DODAVATEL_SELECT,
      produkty: {
        select: {
          id: true, objednaciKod: true, nakupniCena: true, dodaciLhuta: true, hlavni: true,
          product: { select: { id: true, kod: true, nazev: true, jednotka: true, aktivni: true } },
        },
        orderBy: { product: { nazev: 'asc' } },
      },
      objednavky: {
        select: { id: true, cislo: true, stav: true, vytvoreno: true, zakazka: { select: { id: true, cislo: true, nazev: true } } },
        orderBy: { vytvoreno: 'desc' },
        take: 20,
      },
    },
  })
  if (!d) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    ...d,
    produkty: d.produkty.map(p => ({
      ...p,
      nakupniCena: perms.financeNakupky && p.nakupniCena !== null ? Number(p.nakupniCena) : null,
    })),
  })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (getPerms(session.user).sklad !== 'PLNY') return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const existing = await db.dodavatel.findFirst({ where: { id: params.id, orgId }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data = dodavatelDataFromBody(body)
  const chyba = validateDodavatel(data, false)
  if (chyba) return NextResponse.json({ error: chyba }, { status: 400 })

  const d = await db.dodavatel.update({ where: { id: params.id }, data, select: DODAVATEL_SELECT })
  return NextResponse.json(d)
}

/** Smazání: dodavatel s objednávkami se jen deaktivuje (objednávky na něj odkazují). */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (getPerms(session.user).sklad !== 'PLNY') return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const existing = await db.dodavatel.findFirst({
    where: { id: params.id, orgId },
    select: { id: true, _count: { select: { objednavky: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (existing._count.objednavky > 0) {
    await db.dodavatel.update({ where: { id: params.id }, data: { aktivni: false } })
    return NextResponse.json({ ok: true, deaktivovan: true })
  }
  await db.dodavatel.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true, deaktivovan: false })
}
