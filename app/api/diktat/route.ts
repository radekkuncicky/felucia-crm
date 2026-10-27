import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { parseDiktatDatum, parseDiktatText, vytvorDiktat, zitraPraha } from '@/lib/diktat'

/** POST /api/diktat { text, datum? } — nadiktovaný hovor jako úkol (výchozí zítra) */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).obchod) return forbidden()

  const body = await req.json().catch(() => ({}))
  const text = parseDiktatText(body.text)
  if (!text) return NextResponse.json({ error: 'Diktát je prázdný' }, { status: 400 })
  const datum = body.datum === undefined ? parseDiktatDatum(zitraPraha()) : parseDiktatDatum(body.datum)
  if (!datum) return NextResponse.json({ error: 'Neplatné datum' }, { status: 400 })

  const { orgId, id: userId } = session.user
  const diktat = await vytvorDiktat(orgPrisma(orgId), orgId, userId, { text, datum })
  return NextResponse.json(diktat, { status: 201 })
}
