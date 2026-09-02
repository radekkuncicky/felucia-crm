import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { najdiDuplicitnihoKlienta } from '@/lib/clientDuplicate'

// POST /api/clients/check-duplicate — { jmeno?, prijmeni?, telefon?, email? }
// -> { match: { id, jmeno, prijmeni, telefon, email } | null }
// Používá se před založením klienta (web formulář Nový klient i inline
// vytvoření klienta z formuláře Nového OP).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(getPerms(session.user).obchod || getPerms(session.user).zakazkyEdit)) return forbidden()
  const orgId = session.user.orgId

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Neplatná data požadavku.' }, { status: 400 })
  }
  const { jmeno, prijmeni, telefon, email } = body as Record<string, unknown>

  const klienti = await orgPrisma(orgId).client.findMany({
    where: { orgId },
    select: { id: true, jmeno: true, prijmeni: true, telefon: true, email: true },
  })

  const match = najdiDuplicitnihoKlienta(klienti, {
    jmeno: typeof jmeno === 'string' ? jmeno : null,
    prijmeni: typeof prijmeni === 'string' ? prijmeni : null,
    telefon: typeof telefon === 'string' ? telefon : null,
    email: typeof email === 'string' ? email : null,
  })

  return NextResponse.json({ match })
}
