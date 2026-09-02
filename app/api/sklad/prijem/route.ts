import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (getPerms(session.user).sklad !== 'PLNY') return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const { nazev, mnozstvi, nakupniCena, poznamka } = await req.json()

  if (!nazev?.trim() || !mnozstvi || nakupniCena === undefined) {
    return NextResponse.json({ error: 'Chybí povinná pole' }, { status: 400 })
  }

  const pohyb = await db.skladPohyb.create({
    data: {
      orgId,
      typ: 'PRIJEM_SKLAD',
      nazev,
      mnozstvi: Number(mnozstvi),
      nakupniCena: Number(nakupniCena),
      duvod: poznamka ?? null,
      vytvorilId: session.user.id,
    },
    include: {
      vytvoril: { select: { jmeno: true } },
    },
  })

  return NextResponse.json(pohyb, { status: 201 })
}
