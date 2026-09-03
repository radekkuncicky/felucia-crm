import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { getAktivniDefinice } from '@/lib/zamereniDefinice'
import { Technologie } from '@prisma/client'

// GET /api/mobile/obchod/zamereni-definice?typ=KLIMA — aktivní definice formuláře.
// Bez ?typ vrátí definice všech typů (appka si je cachne pro offline).
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const db = orgPrisma(session!.user.orgId)
  const typ = new URL(req.url).searchParams.get('typ')

  if (typ) {
    if (!Object.values(Technologie).includes(typ as Technologie)) {
      return NextResponse.json({ error: 'Neplatný typ' }, { status: 400 })
    }
    return NextResponse.json(await getAktivniDefinice(db, typ as Technologie))
  }

  const vse = await Promise.all(
    Object.values(Technologie).map(t => getAktivniDefinice(db, t)),
  )
  return NextResponse.json(vse)
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
