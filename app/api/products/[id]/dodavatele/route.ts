import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'

const VAZBA_SELECT = {
  id: true, dodavatelId: true, objednaciKod: true, nakupniCena: true, dodaciLhuta: true, hlavni: true,
  dodavatel: { select: { id: true, nazev: true, email: true, aktivni: true } },
} as const

function serialize(v: { nakupniCena: unknown } & Record<string, unknown>, showNakupky: boolean) {
  return { ...v, nakupniCena: showNakupky && v.nakupniCena !== null ? Number(v.nakupniCena) : null }
}

/** Dodavatelé produktu (vazby s objednacím kódem a nákupní cenou). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  const orgId = session.user.orgId
  const rows = await orgPrisma(orgId).productDodavatel.findMany({
    where: { orgId, productId: params.id },
    select: VAZBA_SELECT,
    orderBy: [{ hlavni: 'desc' }, { dodavatel: { nazev: 'asc' } }],
  })
  return NextResponse.json(rows.map(r => serialize(r, perms.financeNakupky)))
}

/** Přidá dodavatele k produktu. První vazba je automaticky hlavní. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (perms.sklad !== 'PLNY') return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const body = await req.json().catch(() => ({}))
  const { dodavatelId, objednaciKod, nakupniCena, dodaciLhuta, hlavni } = body
  if (!dodavatelId) return NextResponse.json({ error: 'Chybí dodavatel' }, { status: 400 })

  const [product, dodavatel] = await Promise.all([
    db.product.findFirst({ where: { id: params.id, orgId }, select: { id: true } }),
    db.dodavatel.findFirst({ where: { id: dodavatelId, orgId }, select: { id: true } }),
  ])
  if (!product || !dodavatel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const existuje = await db.productDodavatel.findFirst({ where: { orgId, productId: params.id, dodavatelId }, select: { id: true } })
  if (existuje) return NextResponse.json({ error: 'Tento dodavatel už je u produktu' }, { status: 409 })

  const pocet = await db.productDodavatel.count({ where: { orgId, productId: params.id } })
  const budeHlavni = pocet === 0 || hlavni === true

  const vazba = await db.$transaction(async tx => {
    if (budeHlavni) await tx.productDodavatel.updateMany({ where: { orgId, productId: params.id }, data: { hlavni: false } })
    return tx.productDodavatel.create({
      data: {
        orgId,
        productId: params.id,
        dodavatelId,
        objednaciKod: typeof objednaciKod === 'string' && objednaciKod.trim() ? objednaciKod.trim() : null,
        nakupniCena: perms.financeNakupkyEdit && nakupniCena !== undefined && nakupniCena !== null && nakupniCena !== '' ? Number(nakupniCena) : null,
        dodaciLhuta: typeof dodaciLhuta === 'string' && dodaciLhuta.trim() ? dodaciLhuta.trim() : null,
        hlavni: budeHlavni,
      },
      select: VAZBA_SELECT,
    })
  })
  return NextResponse.json(serialize(vazba, perms.financeNakupky), { status: 201 })
}
