import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'
import { DODAVATEL_SELECT, dodavatelDataFromBody, validateDodavatel } from '@/lib/dodavatele'

/** Seznam dodavatelů org (čtení skladu). `?vse=1` vrátí i neaktivní. */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (getPerms(session.user).sklad === 'ZADNY') return forbidden()

  const orgId = session.user.orgId
  const vse = new URL(req.url).searchParams.get('vse') === '1'
  const rows = await orgPrisma(orgId).dodavatel.findMany({
    where: { orgId, ...(vse ? {} : { aktivni: true }) },
    select: { ...DODAVATEL_SELECT, _count: { select: { produkty: true, objednavky: true } } },
    orderBy: { nazev: 'asc' },
  })
  return NextResponse.json(rows.map(r => ({ ...r, pocetProduktu: r._count.produkty, pocetObjednavek: r._count.objednavky, _count: undefined })))
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (getPerms(session.user).sklad !== 'PLNY') return forbidden()

  const orgId = session.user.orgId
  const body = await req.json().catch(() => ({}))
  const data = dodavatelDataFromBody(body)
  const chyba = validateDodavatel(data, true)
  if (chyba) return NextResponse.json({ error: chyba }, { status: 400 })

  const d = await orgPrisma(orgId).dodavatel.create({
    data: { orgId, ...data, nazev: data.nazev as string },
    select: DODAVATEL_SELECT,
  })
  return NextResponse.json({ ...d, pocetProduktu: 0, pocetObjednavek: 0 }, { status: 201 })
}
